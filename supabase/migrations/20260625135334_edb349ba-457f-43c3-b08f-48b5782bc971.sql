
CREATE TABLE public.stock_depletion_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  depleted_products JSONB NOT NULL DEFAULT '[]'::jsonb,
  affected_lists JSONB NOT NULL DEFAULT '[]'::jsonb,
  admin_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  emails_sent INTEGER NOT NULL DEFAULT 0,
  emails_failed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ok',
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.stock_depletion_notifications TO authenticated;
GRANT ALL ON public.stock_depletion_notifications TO service_role;

ALTER TABLE public.stock_depletion_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view stock depletion notifications"
  ON public.stock_depletion_notifications FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX idx_stock_depletion_notifications_created_at
  ON public.stock_depletion_notifications (created_at DESC);
