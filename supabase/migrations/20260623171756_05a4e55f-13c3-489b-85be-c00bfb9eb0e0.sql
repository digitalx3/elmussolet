
-- 1. Audit table
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  order_item_id uuid,
  product_id uuid NOT NULL,
  variant_id uuid,
  list_item_id uuid,
  delta integer NOT NULL,
  reason text NOT NULL,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_product_idx ON public.stock_movements(product_id, created_at DESC);
CREATE INDEX stock_movements_order_idx ON public.stock_movements(order_id);

GRANT SELECT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view stock movements"
  ON public.stock_movements FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 2. Drop old helper and replace with locking + audit version
DROP FUNCTION IF EXISTS public.apply_order_item_stock_delta(uuid, uuid, uuid, integer) CASCADE;

CREATE OR REPLACE FUNCTION public.apply_order_item_stock_delta(
  _product_id uuid,
  _variant_id uuid,
  _list_item_id uuid,
  _delta integer,
  _order_id uuid DEFAULT NULL,
  _order_item_id uuid DEFAULT NULL,
  _reason text DEFAULT 'unknown'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current integer;
BEGIN
  IF _delta = 0 THEN
    RETURN;
  END IF;

  -- Lock the relevant row & enforce availability for positive (consume) deltas
  IF _variant_id IS NOT NULL THEN
    SELECT stock_quantity INTO v_current
      FROM public.product_variants
     WHERE id = _variant_id
     FOR UPDATE;

    IF _delta > 0 AND COALESCE(v_current, 0) < _delta THEN
      RAISE EXCEPTION 'STOCK_INSUFFICIENT'
        USING HINT = 'variant', ERRCODE = 'P0001';
    END IF;

    UPDATE public.product_variants
       SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - _delta)
     WHERE id = _variant_id;
  ELSE
    SELECT stock_quantity INTO v_current
      FROM public.products
     WHERE id = _product_id
     FOR UPDATE;

    IF _delta > 0 AND COALESCE(v_current, 0) < _delta THEN
      RAISE EXCEPTION 'STOCK_INSUFFICIENT'
        USING HINT = 'product', ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Always also reflect on parent product (UI badge source of truth)
  UPDATE public.products
     SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - _delta)
   WHERE id = _product_id;

  IF _list_item_id IS NOT NULL THEN
    UPDATE public.list_items
       SET quantity_purchased = GREATEST(0, COALESCE(quantity_purchased, 0) + _delta)
     WHERE id = _list_item_id;
  END IF;

  -- Audit log
  INSERT INTO public.stock_movements(
    order_id, order_item_id, product_id, variant_id, list_item_id, delta, reason, actor
  ) VALUES (
    _order_id, _order_item_id, _product_id, _variant_id, _list_item_id, _delta, _reason, auth.uid()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_order_item_stock_delta(uuid, uuid, uuid, integer, uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_order_item_stock_delta(uuid, uuid, uuid, integer, uuid, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_order_item_stock_delta(uuid, uuid, uuid, integer, uuid, uuid, text) FROM authenticated;

-- 3. Recreate order_items trigger function to pass audit context
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
        NEW.product_id, NEW.variant_id, NEW.list_item_id, NEW.quantity,
        NEW.order_id, NEW.id, 'order_item_insert'
      );
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    SELECT status INTO new_status FROM public.orders WHERE id = NEW.order_id;
    IF new_status IS DISTINCT FROM 'cancelled' THEN
      PERFORM public.apply_order_item_stock_delta(
        OLD.product_id, OLD.variant_id, OLD.list_item_id, -OLD.quantity,
        OLD.order_id, OLD.id, 'order_item_update_reverse'
      );
      PERFORM public.apply_order_item_stock_delta(
        NEW.product_id, NEW.variant_id, NEW.list_item_id, NEW.quantity,
        NEW.order_id, NEW.id, 'order_item_update_apply'
      );
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    SELECT status INTO old_status FROM public.orders WHERE id = OLD.order_id;
    IF old_status IS NULL OR old_status IS DISTINCT FROM 'cancelled' THEN
      PERFORM public.apply_order_item_stock_delta(
        OLD.product_id, OLD.variant_id, OLD.list_item_id, -OLD.quantity,
        OLD.order_id, OLD.id, 'order_item_delete'
      );
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- Recreate trigger dropped by CASCADE above
DROP TRIGGER IF EXISTS trg_order_items_stock ON public.order_items;
CREATE TRIGGER trg_order_items_stock
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.order_items_stock_trigger();

-- 4. Recreate orders status trigger to pass audit context
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

  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    FOR it IN
      SELECT id, product_id, variant_id, list_item_id, quantity
      FROM public.order_items WHERE order_id = NEW.id
    LOOP
      PERFORM public.apply_order_item_stock_delta(
        it.product_id, it.variant_id, it.list_item_id, -it.quantity,
        NEW.id, it.id, 'order_cancelled'
      );
    END LOOP;
  ELSIF OLD.status = 'cancelled' AND NEW.status IS DISTINCT FROM 'cancelled' THEN
    FOR it IN
      SELECT id, product_id, variant_id, list_item_id, quantity
      FROM public.order_items WHERE order_id = NEW.id
    LOOP
      PERFORM public.apply_order_item_stock_delta(
        it.product_id, it.variant_id, it.list_item_id, it.quantity,
        NEW.id, it.id, 'order_reopened'
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
