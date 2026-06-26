
ALTER TABLE public.product_translations      ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.brand_translations        ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.category_translations     ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.variant_type_translations ADD COLUMN IF NOT EXISTS slug text;

UPDATE public.product_translations pt
   SET slug = p.slug
  FROM public.products p
 WHERE pt.product_id = p.id AND (pt.slug IS NULL OR pt.slug = '') AND p.slug IS NOT NULL;

UPDATE public.category_translations ct
   SET slug = c.slug
  FROM public.categories c
 WHERE ct.category_id = c.id AND (ct.slug IS NULL OR ct.slug = '') AND c.slug IS NOT NULL;

UPDATE public.variant_type_translations vtt
   SET slug = vt.slug
  FROM public.variant_types vt
 WHERE vtt.variant_type_id = vt.id AND (vtt.slug IS NULL OR vtt.slug = '') AND vt.slug IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_translations_lang_slug_uniq
  ON public.product_translations (language, slug)
  WHERE slug IS NOT NULL AND slug <> '';

CREATE UNIQUE INDEX IF NOT EXISTS brand_translations_lang_slug_uniq
  ON public.brand_translations (language_code, slug)
  WHERE slug IS NOT NULL AND slug <> '';

CREATE UNIQUE INDEX IF NOT EXISTS category_translations_lang_slug_uniq
  ON public.category_translations (language, slug)
  WHERE slug IS NOT NULL AND slug <> '';

CREATE UNIQUE INDEX IF NOT EXISTS variant_type_translations_lang_slug_uniq
  ON public.variant_type_translations (language, slug)
  WHERE slug IS NOT NULL AND slug <> '';

CREATE INDEX IF NOT EXISTS product_translations_slug_idx
  ON public.product_translations (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS category_translations_slug_idx
  ON public.category_translations (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS brand_translations_slug_idx
  ON public.brand_translations (slug) WHERE slug IS NOT NULL;
