
-- 1. languages table
CREATE TABLE public.languages (
  code text PRIMARY KEY,
  name text NOT NULL,
  native_name text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.languages TO anon, authenticated;
GRANT ALL ON public.languages TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.languages TO authenticated;

ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "languages_select_all" ON public.languages FOR SELECT USING (true);
CREATE POLICY "languages_admin_insert" ON public.languages FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "languages_admin_update" ON public.languages FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "languages_admin_delete" ON public.languages FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_languages_updated_at BEFORE UPDATE ON public.languages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- enforce only one default
CREATE UNIQUE INDEX languages_one_default_idx ON public.languages ((is_default)) WHERE is_default = true;

INSERT INTO public.languages (code, name, native_name, is_enabled, is_default, sort_order) VALUES
  ('ca', 'Catalan', 'Català', true, true, 1),
  ('es', 'Spanish', 'Español', true, false, 2);

-- 2. brand_translations
CREATE TABLE public.brand_translations (
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  language_code text NOT NULL REFERENCES public.languages(code) ON DELETE RESTRICT,
  name text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (brand_id, language_code)
);

GRANT SELECT ON public.brand_translations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.brand_translations TO authenticated;
GRANT ALL ON public.brand_translations TO service_role;

ALTER TABLE public.brand_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_translations_select_all" ON public.brand_translations FOR SELECT USING (true);
CREATE POLICY "brand_translations_admin_write" ON public.brand_translations FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_brand_translations_updated_at BEFORE UPDATE ON public.brand_translations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. list_section_translations
CREATE TABLE public.list_section_translations (
  section_id uuid NOT NULL REFERENCES public.list_sections(id) ON DELETE CASCADE,
  language_code text NOT NULL REFERENCES public.languages(code) ON DELETE RESTRICT,
  name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (section_id, language_code)
);

GRANT SELECT ON public.list_section_translations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.list_section_translations TO authenticated;
GRANT ALL ON public.list_section_translations TO service_role;

ALTER TABLE public.list_section_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "list_section_translations_select_all" ON public.list_section_translations FOR SELECT USING (true);
CREATE POLICY "list_section_translations_admin_write" ON public.list_section_translations FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_list_section_translations_updated_at BEFORE UPDATE ON public.list_section_translations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- migrate list_sections name_ca/name_es
INSERT INTO public.list_section_translations (section_id, language_code, name)
SELECT id, 'ca', name_ca FROM public.list_sections WHERE name_ca IS NOT NULL;
INSERT INTO public.list_section_translations (section_id, language_code, name)
SELECT id, 'es', name_es FROM public.list_sections WHERE name_es IS NOT NULL;

-- 4. cms_block_translations
CREATE TABLE public.cms_block_translations (
  block_id uuid NOT NULL REFERENCES public.cms_blocks(id) ON DELETE CASCADE,
  language_code text NOT NULL REFERENCES public.languages(code) ON DELETE RESTRICT,
  title text,
  subtitle text,
  content text,
  cta_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (block_id, language_code)
);

GRANT SELECT ON public.cms_block_translations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cms_block_translations TO authenticated;
GRANT ALL ON public.cms_block_translations TO service_role;

ALTER TABLE public.cms_block_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cms_block_translations_select_all" ON public.cms_block_translations FOR SELECT USING (true);
CREATE POLICY "cms_block_translations_admin_write" ON public.cms_block_translations FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_cms_block_translations_updated_at BEFORE UPDATE ON public.cms_block_translations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.cms_block_translations (block_id, language_code, title, subtitle, content, cta_label)
SELECT id, 'ca', title_ca, subtitle_ca, content_ca, cta_label_ca FROM public.cms_blocks
WHERE title_ca IS NOT NULL OR subtitle_ca IS NOT NULL OR content_ca IS NOT NULL OR cta_label_ca IS NOT NULL;
INSERT INTO public.cms_block_translations (block_id, language_code, title, subtitle, content, cta_label)
SELECT id, 'es', title_es, subtitle_es, content_es, cta_label_es FROM public.cms_blocks
WHERE title_es IS NOT NULL OR subtitle_es IS NOT NULL OR content_es IS NOT NULL OR cta_label_es IS NOT NULL;

-- 5. hero_slide_translations
CREATE TABLE public.hero_slide_translations (
  slide_id uuid NOT NULL REFERENCES public.hero_slides(id) ON DELETE CASCADE,
  language_code text NOT NULL REFERENCES public.languages(code) ON DELETE RESTRICT,
  badge_text text,
  title text,
  subtitle text,
  button1_text text,
  button2_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (slide_id, language_code)
);

GRANT SELECT ON public.hero_slide_translations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hero_slide_translations TO authenticated;
GRANT ALL ON public.hero_slide_translations TO service_role;

ALTER TABLE public.hero_slide_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hero_slide_translations_select_all" ON public.hero_slide_translations FOR SELECT USING (true);
CREATE POLICY "hero_slide_translations_admin_write" ON public.hero_slide_translations FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_hero_slide_translations_updated_at BEFORE UPDATE ON public.hero_slide_translations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.hero_slide_translations (slide_id, language_code, badge_text, title, subtitle, button1_text, button2_text)
SELECT id, 'ca', badge_text_ca, title_ca, subtitle_ca, button1_text_ca, button2_text_ca FROM public.hero_slides;
INSERT INTO public.hero_slide_translations (slide_id, language_code, badge_text, title, subtitle, button1_text, button2_text)
SELECT id, 'es', badge_text_es, title_es, subtitle_es, button1_text_es, button2_text_es FROM public.hero_slides;
