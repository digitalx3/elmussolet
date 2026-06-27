
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_by uuid;

ALTER TABLE public.contact_messages
  DROP CONSTRAINT IF EXISTS contact_messages_status_check;
ALTER TABLE public.contact_messages
  ADD CONSTRAINT contact_messages_status_check CHECK (status IN ('open','closed'));

CREATE TABLE IF NOT EXISTS public.contact_message_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.contact_messages(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('admin','customer')),
  body text NOT NULL,
  author_id uuid,
  author_name text,
  email_sent boolean NOT NULL DEFAULT false,
  email_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_message_replies TO authenticated;
GRANT ALL ON public.contact_message_replies TO service_role;

ALTER TABLE public.contact_message_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read replies" ON public.contact_message_replies;
CREATE POLICY "Admins read replies" ON public.contact_message_replies
  FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins insert replies" ON public.contact_message_replies;
CREATE POLICY "Admins insert replies" ON public.contact_message_replies
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins delete replies" ON public.contact_message_replies;
CREATE POLICY "Admins delete replies" ON public.contact_message_replies
  FOR DELETE USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS contact_message_replies_message_id_idx
  ON public.contact_message_replies(message_id, created_at);
