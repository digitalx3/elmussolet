
-- 1) list_items: drop overly broad SELECT policy. Owners + admins keep ALL policy.
DROP POLICY IF EXISTS "Authenticated users can view list items" ON public.list_items;

-- 2) list_sections: same
DROP POLICY IF EXISTS "Authenticated users can view list sections" ON public.list_sections;

-- 3) list_owners: tighten SELECT to own row + admin
DROP POLICY IF EXISTS "Users can view own list owners" ON public.list_owners;
CREATE POLICY "Users can view own list owners"
  ON public.list_owners
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- 4) birth_lists: hide password_hash at the column-grant level from API roles
REVOKE SELECT (password_hash) ON public.birth_lists FROM anon, authenticated;

-- 5) Storage policies for brand-logos and site-assets (UPDATE + DELETE, admin-only)
DROP POLICY IF EXISTS "Admin update brand logos" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete brand logos" ON storage.objects;
DROP POLICY IF EXISTS "Admin update site assets" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete site assets" ON storage.objects;

CREATE POLICY "Admin update brand logos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'brand-logos' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'brand-logos' AND public.is_admin(auth.uid()));

CREATE POLICY "Admin delete brand logos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'brand-logos' AND public.is_admin(auth.uid()));

CREATE POLICY "Admin update site assets"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'site-assets' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'site-assets' AND public.is_admin(auth.uid()));

CREATE POLICY "Admin delete site assets"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'site-assets' AND public.is_admin(auth.uid()));

-- 6) Revoke EXECUTE on SECURITY DEFINER functions that are only used internally by triggers.
--    Triggers run as the table owner regardless of grants, so this does not break behaviour.
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_self_role_escalation()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.order_items_stock_trigger()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orders_status_stock_trigger()        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_birth_list_created_by()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_birth_list_limit()           FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_order_item_stock_delta(uuid, uuid, uuid, integer, uuid, uuid, text) FROM PUBLIC, anon, authenticated;

COMMENT ON POLICY "Users can view own list owners" ON public.list_owners IS
  'Users only see their own owner row. Co-owner names needed for the public registry view are served via the verify-list-access / get-public-list-data edge functions using the service role.';
