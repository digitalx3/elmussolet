
CREATE TABLE public.order_deletion_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  order_number text,
  order_status text,
  payment_status text,
  list_id uuid,
  user_id uuid,
  total numeric,
  order_items_deleted integer NOT NULL DEFAULT 0,
  stock_movements_created integer NOT NULL DEFAULT 0,
  list_items_affected integer NOT NULL DEFAULT 0,
  order_snapshot jsonb,
  items_snapshot jsonb,
  deleted_by uuid,
  deleted_by_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.order_deletion_audit TO authenticated;
GRANT ALL ON public.order_deletion_audit TO service_role;

ALTER TABLE public.order_deletion_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view order deletion audit"
  ON public.order_deletion_audit FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert order deletion audit"
  ON public.order_deletion_audit FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND deleted_by = auth.uid());

CREATE INDEX idx_order_deletion_audit_created_at ON public.order_deletion_audit (created_at DESC);
CREATE INDEX idx_order_deletion_audit_deleted_by ON public.order_deletion_audit (deleted_by);
