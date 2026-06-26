
-- 1. Backfill: all current admins get all permissions to preserve current access
INSERT INTO public.user_permissions (user_id, permission)
SELECT ur.user_id, p.perm::public.app_permission
FROM public.user_roles ur
CROSS JOIN (VALUES
  ('ai_features'), ('ai_history'),
  ('manage_translations'), ('manage_smtp'),
  ('manage_backups'), ('manage_users'), ('manage_cookies')
) AS p(perm)
WHERE ur.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur2
     WHERE ur2.user_id = ur.user_id AND ur2.role = 'super_admin'
  )
ON CONFLICT DO NOTHING;

-- Also backfill for legacy admins (profiles.role='admin') that may not have user_roles row
INSERT INTO public.user_permissions (user_id, permission)
SELECT pr.id, p.perm::public.app_permission
FROM public.profiles pr
CROSS JOIN (VALUES
  ('ai_features'), ('ai_history'),
  ('manage_translations'), ('manage_smtp'),
  ('manage_backups'), ('manage_users'), ('manage_cookies')
) AS p(perm)
WHERE pr.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = pr.id AND ur.role = 'super_admin'
  )
ON CONFLICT DO NOTHING;

-- 2. Enable permission enforcement
INSERT INTO public.site_settings (key, value)
VALUES ('permissions_enforced', 'true'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = 'true'::jsonb;

-- 3. Tighten user_permissions RLS so only super_admin can modify
DROP POLICY IF EXISTS "Super admins manage permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Admins view own permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Super admins read all permissions" ON public.user_permissions;

CREATE POLICY "Super admins manage permissions"
  ON public.user_permissions
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Users view own permissions"
  ON public.user_permissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));
