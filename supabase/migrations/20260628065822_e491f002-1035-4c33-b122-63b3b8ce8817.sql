DROP POLICY IF EXISTS "Admin upload brand logos" ON storage.objects;
CREATE POLICY "Admin upload brand logos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'brand-logos' AND public.is_admin(auth.uid()));