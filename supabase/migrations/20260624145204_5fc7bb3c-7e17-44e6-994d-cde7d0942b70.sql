
CREATE TABLE public.maintenance_settings (
  id uuid PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  enabled boolean NOT NULL DEFAULT false,
  show_logo boolean NOT NULL DEFAULT true,
  message_ca text NOT NULL DEFAULT '',
  message_es text NOT NULL DEFAULT '',
  allowed_ips text[] NOT NULL DEFAULT '{}'::text[],
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  singleton boolean NOT NULL DEFAULT true,
  CONSTRAINT maintenance_settings_singleton_uk UNIQUE (singleton)
);

GRANT SELECT ON public.maintenance_settings TO anon, authenticated;
GRANT UPDATE ON public.maintenance_settings TO authenticated;
GRANT ALL ON public.maintenance_settings TO service_role;

ALTER TABLE public.maintenance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "maintenance_settings_select_all"
  ON public.maintenance_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "maintenance_settings_update_admin"
  ON public.maintenance_settings FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER maintenance_settings_updated_at
  BEFORE UPDATE ON public.maintenance_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.maintenance_settings (id) VALUES ('00000000-0000-0000-0000-000000000001'::uuid)
  ON CONFLICT (id) DO NOTHING;
