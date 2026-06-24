
CREATE TABLE public.ai_translation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  function_name text NOT NULL,
  scope text,
  source_language text,
  target_language text,
  items_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  status text NOT NULL,
  provider text,
  error_message text,
  duration_ms integer,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ai_translation_logs TO authenticated;
GRANT ALL ON public.ai_translation_logs TO service_role;

ALTER TABLE public.ai_translation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read ai logs"
  ON public.ai_translation_logs FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins insert ai logs"
  ON public.ai_translation_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX ai_translation_logs_created_at_idx ON public.ai_translation_logs (created_at DESC);
CREATE INDEX ai_translation_logs_status_idx ON public.ai_translation_logs (status);
