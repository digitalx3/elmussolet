
CREATE TABLE public.default_list_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.default_list_sections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.default_list_sections TO authenticated;
GRANT ALL ON public.default_list_sections TO service_role;

ALTER TABLE public.default_list_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view default list sections"
ON public.default_list_sections FOR SELECT
USING (true);

CREATE POLICY "Admins manage default list sections"
ON public.default_list_sections FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_default_list_sections_updated_at
  BEFORE UPDATE ON public.default_list_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.default_list_section_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.default_list_sections(id) ON DELETE CASCADE,
  language text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (section_id, language)
);

GRANT SELECT ON public.default_list_section_translations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.default_list_section_translations TO authenticated;
GRANT ALL ON public.default_list_section_translations TO service_role;

ALTER TABLE public.default_list_section_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view default list section translations"
ON public.default_list_section_translations FOR SELECT
USING (true);

CREATE POLICY "Admins manage default list section translations"
ON public.default_list_section_translations FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_default_list_section_translations_updated_at
  BEFORE UPDATE ON public.default_list_section_translations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial default sections (idempotent)
WITH seed(slug, sort_order, name_ca, name_es) AS (
  VALUES
    ('higiene-personal', 0, 'Higiene personal', 'Higiene personal'),
    ('dormir', 1, 'Dormir', 'Dormir'),
    ('alimentacio', 2, 'Alimentació', 'Alimentación'),
    ('passeig', 3, 'Passeig', 'Paseo'),
    ('per-a-casa', 4, 'Per a casa', 'Para casa'),
    ('cotxe', 5, 'Cotxe', 'Coche'),
    ('mare-hospital', 6, 'Per a la mare (hospital)', 'Para la madre (hospital)'),
    ('bebe-hospital', 7, 'Per al bebè (hospital)', 'Para el bebé (hospital)'),
    ('espera-hospital', 8, 'Per a l''espera (hospital)', 'Para la espera (hospital)')
), ins AS (
  INSERT INTO public.default_list_sections (slug, sort_order, is_active)
  SELECT slug, sort_order, true FROM seed
  ON CONFLICT (slug) DO NOTHING
  RETURNING id, slug
), all_rows AS (
  SELECT id, slug FROM ins
  UNION
  SELECT s.id, s.slug FROM public.default_list_sections s
  WHERE s.slug IN (SELECT slug FROM seed)
)
INSERT INTO public.default_list_section_translations (section_id, language, name)
SELECT ar.id, lang.language, CASE WHEN lang.language = 'ca' THEN seed.name_ca ELSE seed.name_es END
FROM all_rows ar
JOIN seed ON seed.slug = ar.slug
CROSS JOIN (VALUES ('ca'), ('es')) AS lang(language)
ON CONFLICT (section_id, language) DO NOTHING;
