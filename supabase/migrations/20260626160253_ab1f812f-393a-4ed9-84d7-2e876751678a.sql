-- Prevent duplicate slugs per language across translatable taxonomies.
-- Partial unique indexes: only enforce when slug is non-null and non-empty.

CREATE UNIQUE INDEX IF NOT EXISTS product_translations_slug_lang_uniq
  ON public.product_translations (language, slug)
  WHERE slug IS NOT NULL AND slug <> '';

CREATE UNIQUE INDEX IF NOT EXISTS brand_translations_slug_lang_uniq
  ON public.brand_translations (language_code, slug)
  WHERE slug IS NOT NULL AND slug <> '';

CREATE UNIQUE INDEX IF NOT EXISTS category_translations_slug_lang_uniq
  ON public.category_translations (language, slug)
  WHERE slug IS NOT NULL AND slug <> '';

CREATE UNIQUE INDEX IF NOT EXISTS variant_type_translations_slug_lang_uniq
  ON public.variant_type_translations (language, slug)
  WHERE slug IS NOT NULL AND slug <> '';