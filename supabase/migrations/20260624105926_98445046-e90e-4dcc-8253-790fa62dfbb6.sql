CREATE POLICY "Admins can delete smtp send log"
  ON public.smtp_send_log
  FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));