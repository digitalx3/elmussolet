ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS replacement_product_id uuid
    REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_replacement_product_id
  ON public.products(replacement_product_id);