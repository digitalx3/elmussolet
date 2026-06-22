CREATE OR REPLACE FUNCTION public.get_list_purchases(_list_id uuid)
RETURNS TABLE (
  list_item_id uuid,
  order_id uuid,
  order_number text,
  quantity integer,
  payment_status text,
  order_status text,
  buyer_full_name text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    oi.list_item_id,
    o.id AS order_id,
    o.order_number,
    oi.quantity,
    o.payment_status,
    o.status AS order_status,
    COALESCE(p.full_name, '') AS buyer_full_name,
    o.created_at
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  LEFT JOIN public.profiles p ON p.id = o.user_id
  WHERE o.list_id = _list_id
    AND oi.list_item_id IS NOT NULL
    AND (public.user_owns_list(_list_id, auth.uid()) OR public.is_admin(auth.uid()))
  ORDER BY o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_list_purchases(uuid) TO authenticated;