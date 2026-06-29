
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public._slugify_brand(input text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(both '-' FROM regexp_replace(
    lower(public.unaccent(coalesce(input,''))),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

WITH candidates AS (
  SELECT b.id AS brand_id, l.code AS language_code, b.name,
         public._slugify_brand(b.name) AS base_slug
  FROM public.brands b
  CROSS JOIN public.languages l
  WHERE l.is_enabled = true
),
ranked AS (
  SELECT c.*,
         ROW_NUMBER() OVER (PARTITION BY c.language_code, c.base_slug ORDER BY c.brand_id) AS rn
  FROM candidates c
),
final AS (
  SELECT brand_id, language_code, name,
         CASE WHEN rn = 1 THEN base_slug
              ELSE base_slug || '-' || substr(brand_id::text, 1, 6)
         END AS slug
  FROM ranked
)
INSERT INTO public.brand_translations (brand_id, language_code, name, slug)
SELECT brand_id, language_code, name, slug FROM final
ON CONFLICT (brand_id, language_code) DO UPDATE
  SET slug = COALESCE(NULLIF(public.brand_translations.slug, ''), EXCLUDED.slug);
