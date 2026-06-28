
-- Trigger-only functions: revoke all EXECUTE (triggers fire under SECURITY DEFINER regardless)
REVOKE EXECUTE ON FUNCTION public.set_birth_list_created_by() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.order_items_stock_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_self_role_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orders_status_stock_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.products_sync_tax_prices() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_replacement_product() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_contact_message_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_replacement_referenced() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_birth_list_limit() FROM PUBLIC, anon, authenticated;

-- Internal stock helper: only invoked by triggers
REVOKE EXECUTE ON FUNCTION public.apply_order_item_stock_delta(uuid, uuid, uuid, integer, uuid, uuid, text) FROM PUBLIC, anon, authenticated;

-- Admin-only RPCs: revoke anon (internal check still rejects non-admins)
REVOKE EXECUTE ON FUNCTION public.get_maintenance_settings_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_top_products(timestamptz, timestamptz, integer) FROM PUBLIC, anon;

-- Owner/admin RPCs: revoke anon
REVOKE EXECUTE ON FUNCTION public.get_list_purchases(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_list_block_summary(uuid) FROM PUBLIC, anon;

-- Keep anon/authenticated EXECUTE on RLS helpers (is_admin, user_owns_list, has_role,
-- is_super_admin, has_permission, is_permissions_enforced) — required by public RLS policies.
