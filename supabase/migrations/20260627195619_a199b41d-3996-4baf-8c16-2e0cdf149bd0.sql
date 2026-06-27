
-- 1. Restrict maintenance_settings: drop public SELECT; admins only.
--    Public frontend reads via check-maintenance-access edge function (service role).
DROP POLICY IF EXISTS maintenance_settings_select_all ON public.maintenance_settings;

CREATE POLICY maintenance_settings_select_admin
  ON public.maintenance_settings
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

REVOKE SELECT ON public.maintenance_settings FROM anon;

-- 2. Restrict list_section_translations SELECT to list owners + admins.
DROP POLICY IF EXISTS list_section_translations_select_all ON public.list_section_translations;

CREATE POLICY list_section_translations_select_owners_admins
  ON public.list_section_translations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.list_sections s
      WHERE s.id = list_section_translations.section_id
        AND (public.user_owns_list(s.list_id, auth.uid()) OR public.is_admin(auth.uid()))
    )
  );

REVOKE SELECT ON public.list_section_translations FROM anon;

-- 3. Tighten cookie_consent_log INSERT (replace WITH CHECK (true) with a meaningful check).
DROP POLICY IF EXISTS "Anyone can log their consent" ON public.cookie_consent_log;

CREATE POLICY cookie_consent_log_insert_valid
  ON public.cookie_consent_log
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    policy_version IS NOT NULL
    AND consent IS NOT NULL
    AND (
      -- authenticated: must match own user; anon: must provide anon_id and no user_id
      (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()))
      OR (auth.uid() IS NULL AND user_id IS NULL AND anon_id IS NOT NULL)
    )
  );

-- 4. Revoke EXECUTE on SECURITY DEFINER functions that are NOT used by RLS as helpers
--    (keep has_role / has_permission / is_super_admin / is_permissions_enforced /
--    is_admin / user_owns_list executable per project RLS requirements).
REVOKE EXECUTE ON FUNCTION public.get_maintenance_settings_admin() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_top_products(timestamp with time zone, timestamp with time zone, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.guard_replacement_referenced() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.validate_replacement_product() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.log_contact_message_status_change() FROM anon, public;
