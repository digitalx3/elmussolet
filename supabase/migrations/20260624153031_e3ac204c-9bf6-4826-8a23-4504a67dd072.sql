-- Restrict reads of emergency token columns from anon/authenticated
REVOKE SELECT (emergency_token_hash, emergency_token_expires_at, emergency_token_single_use, emergency_token_used_at)
  ON public.maintenance_settings FROM anon;
REVOKE SELECT (emergency_token_hash, emergency_token_expires_at, emergency_token_single_use, emergency_token_used_at)
  ON public.maintenance_settings FROM authenticated;

-- Admin-only RPC to fetch the full row (incl. token metadata)
CREATE OR REPLACE FUNCTION public.get_maintenance_settings_admin()
RETURNS public.maintenance_settings
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.maintenance_settings;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT * INTO result FROM public.maintenance_settings LIMIT 1;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_maintenance_settings_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_maintenance_settings_admin() TO authenticated;

-- Tighten orders INSERT policy: customer must belong to the authenticated user
DROP POLICY IF EXISTS "Users can create orders" ON public.orders;
CREATE POLICY "Users can create orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = orders.customer_id
        AND c.auth_user_id = auth.uid()
    )
  );