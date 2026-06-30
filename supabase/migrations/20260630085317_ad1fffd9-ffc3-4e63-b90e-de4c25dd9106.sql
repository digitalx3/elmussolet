
ALTER TABLE public.stock_movements ALTER COLUMN product_id DROP NOT NULL;

UPDATE public.stock_movements sm
   SET product_id = NULL
 WHERE product_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = sm.product_id);

UPDATE public.stock_movements sm
   SET variant_id = NULL
 WHERE variant_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.product_variants pv WHERE pv.id = sm.variant_id);

ALTER TABLE public.stock_movements
  DROP CONSTRAINT IF EXISTS stock_movements_product_id_fkey,
  DROP CONSTRAINT IF EXISTS stock_movements_variant_id_fkey,
  ADD CONSTRAINT stock_movements_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL,
  ADD CONSTRAINT stock_movements_variant_id_fkey
    FOREIGN KEY (variant_id) REFERENCES public.product_variants(id) ON DELETE SET NULL;
