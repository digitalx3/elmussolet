
-- Fix list_items: drop RESTRICTIVE SELECT and create PERMISSIVE one for public access
DROP POLICY IF EXISTS "Authenticated can view list items" ON public.list_items;
CREATE POLICY "Anyone can view list items" ON public.list_items
  FOR SELECT
  USING (true);

-- Also fix products-related tables that might block the joined query
-- product_images, product_translations already have public SELECT but they're RESTRICTIVE
-- Let's check and fix them too

-- Fix product_images SELECT
DROP POLICY IF EXISTS "Anyone can view product images" ON public.product_images;
CREATE POLICY "Anyone can view product images" ON public.product_images
  FOR SELECT
  USING (true);

-- Fix product_translations SELECT  
DROP POLICY IF EXISTS "Anyone can view product translations" ON public.product_translations;
CREATE POLICY "Anyone can view product translations" ON public.product_translations
  FOR SELECT
  USING (true);

-- Fix products SELECT
DROP POLICY IF EXISTS "Anyone can view active products" ON public.products;
CREATE POLICY "Anyone can view active products" ON public.products
  FOR SELECT
  USING (true);

-- Fix product_variants SELECT
DROP POLICY IF EXISTS "Anyone can view product variants" ON public.product_variants;
CREATE POLICY "Anyone can view product variants" ON public.product_variants
  FOR SELECT
  USING (true);
