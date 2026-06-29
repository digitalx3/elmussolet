ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS default_section_id uuid REFERENCES public.default_list_sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_default_section_id ON public.products(default_section_id);