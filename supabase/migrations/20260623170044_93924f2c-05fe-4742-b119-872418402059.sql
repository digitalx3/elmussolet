
-- Helper: apply stock & list reservation delta
-- _delta > 0 means consume (stock--, purchased++)
-- _delta < 0 means release (stock++, purchased--)
CREATE OR REPLACE FUNCTION public.apply_order_item_stock_delta(
  _product_id uuid,
  _variant_id uuid,
  _list_item_id uuid,
  _delta integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _delta = 0 THEN
    RETURN;
  END IF;

  IF _variant_id IS NOT NULL THEN
    UPDATE public.product_variants
       SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - _delta)
     WHERE id = _variant_id;
  END IF;

  -- Always also reflect on the parent product stock (single source of truth for UI badge)
  UPDATE public.products
     SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - _delta)
   WHERE id = _product_id;

  IF _list_item_id IS NOT NULL THEN
    UPDATE public.list_items
       SET quantity_purchased = GREATEST(0, COALESCE(quantity_purchased, 0) + _delta)
     WHERE id = _list_item_id;
  END IF;
END;
$$;

-- Trigger function for order_items INSERT / UPDATE / DELETE
CREATE OR REPLACE FUNCTION public.order_items_stock_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_status text;
  new_status text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT status INTO new_status FROM public.orders WHERE id = NEW.order_id;
    IF new_status IS DISTINCT FROM 'cancelled' THEN
      PERFORM public.apply_order_item_stock_delta(
        NEW.product_id, NEW.variant_id, NEW.list_item_id, NEW.quantity
      );
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    SELECT status INTO new_status FROM public.orders WHERE id = NEW.order_id;
    IF new_status IS DISTINCT FROM 'cancelled' THEN
      -- Reverse the OLD row, then apply the NEW row (handles product/variant/list_item/quantity changes)
      PERFORM public.apply_order_item_stock_delta(
        OLD.product_id, OLD.variant_id, OLD.list_item_id, -OLD.quantity
      );
      PERFORM public.apply_order_item_stock_delta(
        NEW.product_id, NEW.variant_id, NEW.list_item_id, NEW.quantity
      );
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    SELECT status INTO old_status FROM public.orders WHERE id = OLD.order_id;
    -- If parent order row was already deleted (cascade) we still want to release stock
    IF old_status IS NULL OR old_status IS DISTINCT FROM 'cancelled' THEN
      PERFORM public.apply_order_item_stock_delta(
        OLD.product_id, OLD.variant_id, OLD.list_item_id, -OLD.quantity
      );
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_stock ON public.order_items;
CREATE TRIGGER trg_order_items_stock
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.order_items_stock_trigger();

-- Trigger on orders to handle cancellation / reopening
CREATE OR REPLACE FUNCTION public.orders_status_stock_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  it record;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Cancelled now, was not before -> release all items
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    FOR it IN
      SELECT product_id, variant_id, list_item_id, quantity
      FROM public.order_items WHERE order_id = NEW.id
    LOOP
      PERFORM public.apply_order_item_stock_delta(
        it.product_id, it.variant_id, it.list_item_id, -it.quantity
      );
    END LOOP;
  -- Was cancelled, now reopened -> consume again
  ELSIF OLD.status = 'cancelled' AND NEW.status IS DISTINCT FROM 'cancelled' THEN
    FOR it IN
      SELECT product_id, variant_id, list_item_id, quantity
      FROM public.order_items WHERE order_id = NEW.id
    LOOP
      PERFORM public.apply_order_item_stock_delta(
        it.product_id, it.variant_id, it.list_item_id, it.quantity
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_status_stock ON public.orders;
CREATE TRIGGER trg_orders_status_stock
AFTER UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_status_stock_trigger();
