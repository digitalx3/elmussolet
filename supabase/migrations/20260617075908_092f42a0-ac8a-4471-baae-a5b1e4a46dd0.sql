
CREATE TABLE public.list_sections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id uuid NOT NULL REFERENCES public.birth_lists(id) ON DELETE CASCADE,
  name_ca text NOT NULL,
  name_es text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.list_sections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_sections TO authenticated;
GRANT ALL ON public.list_sections TO service_role;

ALTER TABLE public.list_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view list sections" ON public.list_sections
  FOR SELECT USING (true);

CREATE POLICY "Owners can manage list sections" ON public.list_sections
  FOR ALL TO authenticated
  USING (public.user_owns_list(list_id, auth.uid()) OR public.is_admin(auth.uid()))
  WITH CHECK (public.user_owns_list(list_id, auth.uid()) OR public.is_admin(auth.uid()));

CREATE TRIGGER update_list_sections_updated_at
  BEFORE UPDATE ON public.list_sections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_list_sections_list_id ON public.list_sections(list_id);

ALTER TABLE public.list_items
  ADD COLUMN section_id uuid REFERENCES public.list_sections(id) ON DELETE SET NULL;

CREATE INDEX idx_list_items_section_id ON public.list_items(section_id);
