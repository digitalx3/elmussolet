
-- 1. Restrict emergency token columns on maintenance_settings
REVOKE SELECT (emergency_token_hash, emergency_token_expires_at, emergency_token_single_use, emergency_token_used_at)
  ON public.maintenance_settings FROM anon, authenticated;

-- 2. Close anonymous customers insert (orders require authenticated anyway)
DROP POLICY IF EXISTS customers_checkout_insert_anon ON public.customers;

-- 3. Revoke EXECUTE on trigger SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.log_order_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_product_default_section_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_pds_subsection() FROM PUBLIC, anon, authenticated;

-- 4. Fix mutable search_path on _slugify_brand
CREATE OR REPLACE FUNCTION public._slugify_brand(input text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path = public
AS $function$
  SELECT trim(both '-' FROM regexp_replace(
    lower(public.unaccent(coalesce(input,''))),
    '[^a-z0-9]+', '-', 'g'
  ));
$function$;

-- 5. Remove broad listing policy on public storage bucket brand-logos
-- (Files remain reachable via the public CDN URL; only directory listing is removed.)
DROP POLICY IF EXISTS "Public read brand logos" ON storage.objects;
