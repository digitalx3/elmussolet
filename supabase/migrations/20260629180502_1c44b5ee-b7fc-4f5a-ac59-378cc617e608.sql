
CREATE TABLE IF NOT EXISTS public.order_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  actor_id uuid,
  actor_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.order_status_log TO authenticated;
GRANT ALL ON public.order_status_log TO service_role;

ALTER TABLE public.order_status_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view order status log"
ON public.order_status_log
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_order_status_log_order_id ON public.order_status_log (order_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT email INTO v_email FROM auth.users WHERE id = auth.uid();
    INSERT INTO public.order_status_log (order_id, from_status, to_status, actor_id, actor_email)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), v_email);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_order_status_change ON public.orders;
CREATE TRIGGER trg_log_order_status_change
AFTER UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.log_order_status_change();
