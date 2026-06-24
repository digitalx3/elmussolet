-- Public read for anonymous visitors (footer pages, public CMS content).
-- The RLS policy already filters to is_active = true OR admin.
GRANT SELECT ON public.cms_blocks TO anon;

-- Authenticated users can read (same RLS filter applies).
GRANT SELECT ON public.cms_blocks TO authenticated;

-- Admins manage rows through the existing "Admins manage cms blocks" policy.
GRANT INSERT, UPDATE, DELETE ON public.cms_blocks TO authenticated;

-- Service role for edge functions / admin scripts.
GRANT ALL ON public.cms_blocks TO service_role;

COMMENT ON TABLE public.cms_blocks IS
'Public CMS blocks and pages. SELECT is intentionally granted to anon and authenticated so footer/menu/page content renders for unauthenticated visitors. RLS policy "Anyone can view active cms blocks" restricts rows to is_active=true (admins can see drafts). Do NOT revoke anon SELECT or public CMS content will disappear from the site.';