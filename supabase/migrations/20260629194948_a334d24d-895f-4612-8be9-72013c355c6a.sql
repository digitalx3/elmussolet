CREATE OR REPLACE FUNCTION public.apply_order_item_stock_delta(_product_id uuid, _variant_id uuid, _list_item_id uuid, _delta integer, _order_id uuid DEFAULT NULL::uuid, _order_item_id uuid DEFAULT NULL::uuid, _reason text DEFAULT 'unknown'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_current integer;
  v_parent_current integer;
BEGIN
  IF _delta = 0 THEN
    RETURN;
  END IF;

  -- Variant path
  IF _variant_id IS NOT NULL THEN
    SELECT stock_quantity INTO v_current
      FROM public.product_variants
     WHERE id = _variant_id
     FOR UPDATE;

    -- stock_quantity = -1 means unlimited (e.g. on_order with no upstream limit)
    IF v_current IS DISTINCT FROM -1 THEN
      IF _delta > 0 AND COALESCE(v_current, 0) < _delta THEN
        RAISE EXCEPTION 'STOCK_INSUFFICIENT'
          USING HINT = 'variant', ERRCODE = 'P0001';
      END IF;
      UPDATE public.product_variants
         SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - _delta)
       WHERE id = _variant_id;
    END IF;
  ELSE
    SELECT stock_quantity INTO v_current
      FROM public.products
     WHERE id = _product_id
     FOR UPDATE;

    IF v_current IS DISTINCT FROM -1 THEN
      IF _delta > 0 AND COALESCE(v_current, 0) < _delta THEN
        RAISE EXCEPTION 'STOCK_INSUFFICIENT'
          USING HINT = 'product', ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  -- Reflect on parent product unless it's unlimited (-1)
  SELECT stock_quantity INTO v_parent_current
    FROM public.products
   WHERE id = _product_id
   FOR UPDATE;

  IF v_parent_current IS DISTINCT FROM -1 THEN
    UPDATE public.products
       SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - _delta)
     WHERE id = _product_id;
  END IF;

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
$function$;