-- 1) profiles: prevent role escalation at INSERT time
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND (role IS NULL OR role = 'customer')
  );

-- 2) list_owners: re-affirm SELECT policy is restricted to owner row or admins (already correct; recreate to lock down explicitly)
DROP POLICY IF EXISTS "Users can view own list owners" ON public.list_owners;
CREATE POLICY "Users can view own list owners"
  ON public.list_owners
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- 3) site_settings: restrict public SELECT to known safe UI/checkout keys (allowlist)
DROP POLICY IF EXISTS "Anyone can view settings" ON public.site_settings;
CREATE POLICY "Public can view safe settings"
  ON public.site_settings
  FOR SELECT
  TO anon, authenticated
  USING (
    key IN (
      'footer_bottom_ca','footer_bottom_es','footer_about_ca','footer_about_es',
      'social_instagram_url','social_facebook_url','social_tiktok_url','social_youtube_url',
      'appearance_config','default_hero_overrides',
      'contact_intro_ca','contact_intro_es','contact_map_iframe_url',
      'store_address','store_phone','store_name','store_email','store_nif',
      'payment_bizum_phone','payment_transfer_iban','payment_transfer_beneficiary',
      'free_shipping_threshold','default_language',
      'logo_header_url','logo_footer_url',
      'site_canonical_url','media_base_url','assets_base_url','api_base_url','storage_provider'
    )
  );

-- 4) Remove anon EXECUTE on is_admin so SECURITY DEFINER fn isn't publicly callable.
--    Split anon-facing SELECT policies that referenced is_admin into role-scoped
--    variants so anonymous footer/CMS rendering keeps working without needing
--    to call is_admin at all.

-- cms_blocks
DROP POLICY IF EXISTS "Anyone can view active cms blocks" ON public.cms_blocks;
CREATE POLICY "Anon can view active cms blocks"
  ON public.cms_blocks
  FOR SELECT
  TO anon
  USING (is_active = true);
CREATE POLICY "Authenticated can view cms blocks"
  ON public.cms_blocks
  FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_admin(auth.uid()));

-- hero_slides
DROP POLICY IF EXISTS "Public can read active hero slides" ON public.hero_slides;
CREATE POLICY "Anon can read active hero slides"
  ON public.hero_slides
  FOR SELECT
  TO anon
  USING (is_active = true);
CREATE POLICY "Authenticated can read hero slides"
  ON public.hero_slides
  FOR SELECT
  TO authenticated
  USING (is_active = true OR public.is_admin(auth.uid()));

-- Now safe to revoke anon EXECUTE on is_admin
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;
-- Keep authenticated grant for authenticated-scoped policies
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

COMMENT ON FUNCTION public.is_admin(uuid) IS
  'SECURITY DEFINER role check. EXECUTE granted to authenticated only; anon must NOT have EXECUTE. Anon-facing SELECT policies (cms_blocks, hero_slides) must avoid calling is_admin and use role-split policies instead.';