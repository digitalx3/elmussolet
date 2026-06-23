
REVOKE EXECUTE ON FUNCTION public.apply_order_item_stock_delta(uuid, uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.order_items_stock_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orders_status_stock_trigger() FROM PUBLIC, anon, authenticated;
