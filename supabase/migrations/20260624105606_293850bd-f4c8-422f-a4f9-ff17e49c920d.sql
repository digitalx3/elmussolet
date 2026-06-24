CREATE TABLE public.smtp_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  subject text NOT NULL,
  smtp_host text,
  test_mode boolean NOT NULL DEFAULT false,
  success boolean NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.smtp_send_log TO authenticated;
GRANT ALL ON public.smtp_send_log TO service_role;

ALTER TABLE public.smtp_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view smtp send log"
  ON public.smtp_send_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX idx_smtp_send_log_created_at ON public.smtp_send_log (created_at DESC);