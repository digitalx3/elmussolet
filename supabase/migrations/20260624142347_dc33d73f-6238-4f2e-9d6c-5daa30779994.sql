
-- ============================================================
-- Bloc 1 — Taula customers desacoblada d'auth.users
-- ============================================================

-- 1) Taula customers
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  full_name text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  postal_code text,
  province text,
  nif text,
  company_name text,
  preferred_language text NOT NULL DEFAULT 'ca',
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX customers_email_unique_active
  ON public.customers (lower(email))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX customers_auth_user_unique_active
  ON public.customers (auth_user_id)
  WHERE auth_user_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX customers_auth_user_idx ON public.customers (auth_user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT ON public.customers TO anon;
GRANT ALL ON public.customers TO service_role;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "customers_admin_all"
  ON public.customers FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "customers_self_select"
  ON public.customers FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "customers_self_update"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "customers_checkout_insert_authenticated"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id IS NULL OR auth_user_id = auth.uid());

CREATE POLICY "customers_checkout_insert_anon"
  ON public.customers FOR INSERT
  TO anon
  WITH CHECK (auth_user_id IS NULL);

-- ============================================================
-- 2) Afegir customer_id a orders i list_owners
-- ============================================================
ALTER TABLE public.orders
  ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE RESTRICT;

ALTER TABLE public.list_owners
  ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX orders_customer_id_idx ON public.orders (customer_id);
CREATE INDEX list_owners_customer_id_idx ON public.list_owners (customer_id);

-- ============================================================
-- 3) Backfill customers a partir de profiles + auth.users
-- ============================================================
INSERT INTO public.customers (
  email, full_name, phone, address_line1, address_line2, city, postal_code, province,
  nif, company_name, preferred_language, auth_user_id, deleted_at, created_at
)
SELECT
  COALESCE(u.email, p.id::text || '@unknown.local'),
  COALESCE(p.full_name, ''),
  p.phone,
  p.address_line1,
  p.address_line2,
  p.city,
  p.postal_code,
  p.province,
  p.nif,
  p.company_name,
  COALESCE(p.preferred_language, 'ca'),
  p.id,
  p.deleted_at,
  COALESCE(p.created_at, now())
FROM public.profiles p
LEFT JOIN auth.users u ON u.id = p.id
ON CONFLICT DO NOTHING;

UPDATE public.orders o
SET customer_id = c.id
FROM public.customers c
WHERE c.auth_user_id = o.user_id
  AND o.customer_id IS NULL;

-- Pedidos orfes: crear customer mínim a partir de shipping_address
INSERT INTO public.customers (
  email, full_name, phone, address_line1, address_line2, city, postal_code, province, auth_user_id
)
SELECT DISTINCT ON (o.user_id)
  COALESCE(NULLIF(o.shipping_address->>'email', ''), o.user_id::text || '@unknown.local'),
  COALESCE(NULLIF(o.shipping_address->>'full_name', ''), 'Client recuperat'),
  NULLIF(o.shipping_address->>'phone', ''),
  NULLIF(o.shipping_address->>'address_line1', ''),
  NULLIF(o.shipping_address->>'address_line2', ''),
  NULLIF(o.shipping_address->>'city', ''),
  NULLIF(o.shipping_address->>'postal_code', ''),
  NULLIF(o.shipping_address->>'province', ''),
  o.user_id
FROM public.orders o
WHERE o.customer_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.auth_user_id = o.user_id);

UPDATE public.orders o
SET customer_id = c.id
FROM public.customers c
WHERE c.auth_user_id = o.user_id
  AND o.customer_id IS NULL;

UPDATE public.list_owners lo
SET customer_id = c.id
FROM public.customers c
WHERE c.auth_user_id = lo.user_id
  AND lo.customer_id IS NULL
  AND lo.user_id IS NOT NULL;

-- ============================================================
-- 4) Validar i fer customer_id NOT NULL a orders
-- ============================================================
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.orders WHERE customer_id IS NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ORDERS_WITH_NULL_CUSTOMER: % files sense customer_id', v_count;
  END IF;
END $$;

ALTER TABLE public.orders ALTER COLUMN customer_id SET NOT NULL;

-- ============================================================
-- 5) Reemplaçar polítiques RLS d'orders i order_items que depenen de user_id
-- ============================================================
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can create order items" ON public.order_items;

CREATE POLICY "Users can view own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = orders.customer_id AND c.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create orders"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = orders.customer_id
        AND (c.auth_user_id = auth.uid() OR c.auth_user_id IS NULL)
    )
  );

CREATE POLICY "Users can view own order items"
  ON public.order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.customers c ON c.id = o.customer_id
      WHERE o.id = order_items.order_id AND c.auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create order items"
  ON public.order_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.customers c ON c.id = o.customer_id
      WHERE o.id = order_items.order_id
        AND (c.auth_user_id = auth.uid() OR c.auth_user_id IS NULL)
    )
  );

-- ============================================================
-- 6) Eliminar columna user_id obsoleta d'orders
-- ============================================================
ALTER TABLE public.orders DROP COLUMN user_id;

-- ============================================================
-- 7) Actualitzar RPC get_list_purchases per usar customer
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_list_purchases(_list_id uuid)
RETURNS TABLE(
  list_item_id uuid, order_id uuid, order_number text, quantity integer,
  payment_status text, order_status text, buyer_full_name text, created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    oi.list_item_id,
    o.id AS order_id,
    o.order_number,
    oi.quantity,
    o.payment_status,
    o.status AS order_status,
    COALESCE(c.full_name, '') AS buyer_full_name,
    o.created_at
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  LEFT JOIN public.customers c ON c.id = o.customer_id
  WHERE o.list_id = _list_id
    AND oi.list_item_id IS NOT NULL
    AND (public.user_owns_list(_list_id, auth.uid()) OR public.is_admin(auth.uid()))
  ORDER BY o.created_at DESC;
$$;

-- ============================================================
-- 8) Auto-vincular customer al crear usuari nou
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_customer_id uuid;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;

  SELECT id INTO v_customer_id
    FROM public.customers
   WHERE lower(email) = lower(NEW.email)
     AND deleted_at IS NULL
   LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (email, full_name, auth_user_id)
    VALUES (NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.id);
  ELSE
    UPDATE public.customers
       SET auth_user_id = NEW.id
     WHERE id = v_customer_id
       AND auth_user_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$;
