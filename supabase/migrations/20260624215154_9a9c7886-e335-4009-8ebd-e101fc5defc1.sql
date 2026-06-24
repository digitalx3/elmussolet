
CREATE TABLE public.ui_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language_code text NOT NULL REFERENCES public.languages(code) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL DEFAULT '',
  ai_generated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(language_code, key)
);

GRANT SELECT ON public.ui_translations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ui_translations TO authenticated;
GRANT ALL ON public.ui_translations TO service_role;

ALTER TABLE public.ui_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ui_translations_select_all" ON public.ui_translations
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "ui_translations_admin_write" ON public.ui_translations
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER ui_translations_set_updated_at
  BEFORE UPDATE ON public.ui_translations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX ui_translations_lang_idx ON public.ui_translations(language_code);

-- Default AI provider setting
INSERT INTO public.site_settings(key, value)
VALUES ('ai_provider', 'lovable')
ON CONFLICT (key) DO NOTHING;
