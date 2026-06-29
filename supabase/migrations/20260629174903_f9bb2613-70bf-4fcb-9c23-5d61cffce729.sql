
-- Remove redundant payment_status (now derived from order status)
ALTER TABLE public.orders DROP COLUMN IF EXISTS payment_status;
ALTER TABLE public.order_deletion_audit DROP COLUMN IF EXISTS payment_status;

-- Recreate get_list_purchases deriving payment_status from order status
CREATE OR REPLACE FUNCTION public.get_list_purchases(_list_id uuid)
 RETURNS TABLE(list_item_id uuid, order_id uuid, order_number text, quantity integer, payment_status text, order_status text, buyer_full_name text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    oi.list_item_id,
    o.id AS order_id,
    o.order_number,
    oi.quantity,
    CASE
      WHEN o.status = 'pending' THEN 'pending'
      WHEN o.status = 'cancelled' THEN 'refunded'
      ELSE 'paid'
    END AS payment_status,
    o.status AS order_status,
    COALESCE(c.full_name, '') AS buyer_full_name,
    o.created_at
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  LEFT JOIN public.customers c ON c.id = o.customer_id
  WHERE o.list_id = _list_id
    AND oi.list_item_id IS NOT NULL
    AND (public.user_owns_list(_list_id, auth.uid()) OR public.is_admin(auth.uid()))
  ORDER BY o.created_at DESC;
$function$;
