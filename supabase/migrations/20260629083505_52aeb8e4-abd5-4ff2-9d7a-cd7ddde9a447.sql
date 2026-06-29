
-- Make brand-logos storage policies self-contained (don't depend on public.is_admin EXECUTE perms)
-- and ensure full coverage for admin/super_admin users.

DROP POLICY IF EXISTS "Admin upload brand logos" ON storage.objects;
DROP POLICY IF EXISTS "Admin update brand logos" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete brand logos" ON storage.objects;
DROP POLICY IF EXISTS "Admin read brand logos" ON storage.objects;

CREATE POLICY "Admin upload brand logos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'brand-logos'
    AND (
      EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','super_admin'))
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );

CREATE POLICY "Admin update brand logos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'brand-logos'
    AND (
      EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','super_admin'))
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  )
  WITH CHECK (
    bucket_id = 'brand-logos'
    AND (
      EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','super_admin'))
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );

CREATE POLICY "Admin delete brand logos" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'brand-logos'
    AND (
      EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','super_admin'))
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );

-- The bucket is public so unauthenticated downloads work via public URL,
-- but the Storage SDK (upsert/list) requires SELECT for authenticated users.
CREATE POLICY "Public read brand logos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'brand-logos');
