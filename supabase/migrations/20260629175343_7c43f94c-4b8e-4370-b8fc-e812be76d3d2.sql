
-- Validate order status transitions
CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed text[];
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS NULL THEN
    RAISE EXCEPTION 'ORDER_STATUS_NULL';
  END IF;

  -- Super admins can override any transition
  IF public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  allowed := CASE COALESCE(OLD.status, 'pending')
    WHEN 'pending'         THEN ARRAY['paid','cancelled','failed']
    WHEN 'failed'          THEN ARRAY['pending','paid','cancelled']
    WHEN 'paid'            THEN ARRAY['preparing','cancelled']
    WHEN 'preparing'       THEN ARRAY['ready','cancelled']
    WHEN 'ready'           THEN ARRAY['awaiting_pickup','shipped','cancelled']
    WHEN 'awaiting_pickup' THEN ARRAY['delivered','cancelled']
    WHEN 'shipped'         THEN ARRAY['delivered','cancelled']
    WHEN 'delivered'       THEN ARRAY[]::text[]
    WHEN 'cancelled'       THEN ARRAY[]::text[]
    ELSE ARRAY[]::text[]
  END;

  IF NOT (NEW.status = ANY(allowed)) THEN
    RAISE EXCEPTION 'ORDER_STATUS_TRANSITION_INVALID'
      USING HINT = format('Transició no permesa: %s → %s', OLD.status, NEW.status);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_status_transition ON public.orders;
CREATE TRIGGER trg_validate_order_status_transition
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_status_transition();
