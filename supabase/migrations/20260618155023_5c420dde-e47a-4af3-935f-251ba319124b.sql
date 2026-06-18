
-- 1) CMS pages menu placement
ALTER TABLE public.cms_blocks
  ADD COLUMN IF NOT EXISTS menu_location text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS menu_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.cms_blocks
  DROP CONSTRAINT IF EXISTS cms_blocks_menu_location_check;
ALTER TABLE public.cms_blocks
  ADD CONSTRAINT cms_blocks_menu_location_check
  CHECK (menu_location IN ('none','header','footer'));

-- 2) SMTP settings (single-row table per is_active=true)
CREATE TABLE IF NOT EXISTS public.smtp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host text NOT NULL DEFAULT '',
  port integer NOT NULL DEFAULT 587,
  username text NOT NULL DEFAULT '',
  password text NOT NULL DEFAULT '',
  security text NOT NULL DEFAULT 'starttls',
  from_email text NOT NULL DEFAULT '',
  from_name text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT smtp_security_check CHECK (security IN ('none','ssl','tls','starttls'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.smtp_settings TO authenticated;
GRANT ALL ON public.smtp_settings TO service_role;

ALTER TABLE public.smtp_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage smtp settings" ON public.smtp_settings;
CREATE POLICY "Admins manage smtp settings"
  ON public.smtp_settings
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS smtp_settings_updated_at ON public.smtp_settings;
CREATE TRIGGER smtp_settings_updated_at
  BEFORE UPDATE ON public.smtp_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
