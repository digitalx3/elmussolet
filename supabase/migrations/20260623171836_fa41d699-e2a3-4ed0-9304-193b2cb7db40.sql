
CREATE OR REPLACE FUNCTION public.get_list_block_summary(_list_id uuid)
RETURNS TABLE(list_item_id uuid, reserved_qty integer, delivered_qty integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    oi.list_item_id,
    COALESCE(SUM(CASE
      WHEN o.status NOT IN ('cancelled','delivered','completed') THEN oi.quantity
      ELSE 0 END), 0)::int AS reserved_qty,
    COALESCE(SUM(CASE
      WHEN o.status IN ('delivered','completed') THEN oi.quantity
      ELSE 0 END), 0)::int AS delivered_qty
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.list_id = _list_id
    AND oi.list_item_id IS NOT NULL
  GROUP BY oi.list_item_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_list_block_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_list_block_summary(uuid) TO anon, authenticated;
