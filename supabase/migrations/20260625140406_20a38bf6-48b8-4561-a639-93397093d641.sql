
-- Sale pricing on products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sale_price_type text CHECK (sale_price_type IN ('fixed','percent')),
  ADD COLUMN IF NOT EXISTS sale_value numeric(10,2),
  ADD COLUMN IF NOT EXISTS sale_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS sale_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS featured_order integer;

CREATE INDEX IF NOT EXISTS products_is_featured_idx ON public.products(is_featured, featured_order) WHERE is_featured = true;

-- Variant signed price modifier
ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS price_modifier numeric(10,2) NOT NULL DEFAULT 0;

-- Related products
CREATE TABLE IF NOT EXISTS public.product_relations (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  related_product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, related_product_id),
  CHECK (product_id <> related_product_id)
);

GRANT SELECT ON public.product_relations TO anon, authenticated;
GRANT ALL ON public.product_relations TO authenticated;
GRANT ALL ON public.product_relations TO service_role;

ALTER TABLE public.product_relations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view product relations"
  ON public.product_relations FOR SELECT
  USING (true);

CREATE POLICY "Admins manage product relations"
  ON public.product_relations FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS product_relations_product_id_idx ON public.product_relations(product_id, position);
