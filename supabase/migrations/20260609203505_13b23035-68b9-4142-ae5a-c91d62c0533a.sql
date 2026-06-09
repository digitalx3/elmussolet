
CREATE TABLE public.hero_slides (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  background_image_url text,
  background_overlay numeric not null default 0.2,
  badge_text_ca text,
  badge_text_es text,
  title_ca text,
  title_es text,
  subtitle_ca text,
  subtitle_es text,
  button1_text_ca text,
  button1_text_es text,
  button1_url text,
  button1_variant text default 'default',
  button2_text_ca text,
  button2_text_es text,
  button2_url text,
  button2_variant text default 'outline',
  layout jsonb not null default '{"desktop":{},"tablet":{},"mobile":{}}'::jsonb,
  canvas_heights jsonb not null default '{"desktop":600,"tablet":520,"mobile":560}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT ON public.hero_slides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hero_slides TO authenticated;
GRANT ALL ON public.hero_slides TO service_role;

ALTER TABLE public.hero_slides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active hero slides"
  ON public.hero_slides FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert hero slides"
  ON public.hero_slides FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update hero slides"
  ON public.hero_slides FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete hero slides"
  ON public.hero_slides FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER update_hero_slides_updated_at
  BEFORE UPDATE ON public.hero_slides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
