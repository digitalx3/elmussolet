-- Align orders admin policy with the central is_admin() helper so that admins
-- created via user_roles (not just legacy profiles.role) can manage every order.
DROP POLICY IF EXISTS "Admins can manage all orders" ON public.orders;

CREATE POLICY "Admins can manage all orders"
  ON public.orders
  FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));