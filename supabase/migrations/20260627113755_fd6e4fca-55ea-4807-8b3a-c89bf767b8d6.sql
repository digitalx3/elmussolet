
CREATE TABLE public.contact_message_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.contact_messages(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_id uuid,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.contact_message_status_log TO authenticated;
GRANT ALL ON public.contact_message_status_log TO service_role;

ALTER TABLE public.contact_message_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view status log"
  ON public.contact_message_status_log FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert status log"
  ON public.contact_message_status_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_cm_status_log_message ON public.contact_message_status_log(message_id, created_at);

CREATE OR REPLACE FUNCTION public.log_contact_message_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_email text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
    INSERT INTO public.contact_message_status_log (message_id, from_status, to_status, actor_id, actor_name)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), v_email);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_contact_message_status ON public.contact_messages;
CREATE TRIGGER trg_log_contact_message_status
  AFTER UPDATE ON public.contact_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.log_contact_message_status_change();
