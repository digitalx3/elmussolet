
CREATE TABLE IF NOT EXISTS public.list_template_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.list_templates(id) ON DELETE CASCADE,
  name_ca text NOT NULL,
  name_es text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.list_template_sections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_template_sections TO authenticated;
GRANT ALL ON public.list_template_sections TO service_role;

ALTER TABLE public.list_template_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sections are publicly readable"
  ON public.list_template_sections FOR SELECT
  USING (true);

CREATE POLICY "Admins manage sections"
  ON public.list_template_sections FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS list_template_sections_template_idx
  ON public.list_template_sections(template_id, sort_order);

CREATE TRIGGER trg_list_template_sections_updated_at
  BEFORE UPDATE ON public.list_template_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Allow template items to belong to a section
ALTER TABLE public.list_template_items
  ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES public.list_template_sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS list_template_items_section_idx
  ON public.list_template_items(section_id);
