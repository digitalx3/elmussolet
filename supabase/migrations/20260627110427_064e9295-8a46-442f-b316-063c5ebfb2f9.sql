
-- Add relation_type to product_relations (upsell / cross_sell)
ALTER TABLE public.product_relations
  ADD COLUMN IF NOT EXISTS relation_type text NOT NULL DEFAULT 'upsell';

ALTER TABLE public.product_relations
  DROP CONSTRAINT IF EXISTS product_relations_relation_type_check;
ALTER TABLE public.product_relations
  ADD CONSTRAINT product_relations_relation_type_check
  CHECK (relation_type IN ('upsell','cross_sell'));

-- Replace PK to allow same related_product_id under different relation types
ALTER TABLE public.product_relations
  DROP CONSTRAINT IF EXISTS product_relations_pkey;
ALTER TABLE public.product_relations
  ADD CONSTRAINT product_relations_pkey
  PRIMARY KEY (product_id, related_product_id, relation_type);

DROP INDEX IF EXISTS public.product_relations_product_id_idx;
CREATE INDEX IF NOT EXISTS product_relations_product_type_pos_idx
  ON public.product_relations(product_id, relation_type, "position");
