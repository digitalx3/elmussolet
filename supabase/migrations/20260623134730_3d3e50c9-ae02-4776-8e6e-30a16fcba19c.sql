DROP POLICY IF EXISTS "Public can read active hero slides" ON public.hero_slides;

CREATE POLICY "Public can read active hero slides"
  ON public.hero_slides
  FOR SELECT
  USING (is_active = true OR public.is_admin(auth.uid()));