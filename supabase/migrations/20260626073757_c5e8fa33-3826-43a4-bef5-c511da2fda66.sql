
-- ============================================================
-- 1) PRODUCT PRICES: gross fields + sync trigger
-- ============================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS base_price_with_tax numeric,
  ADD COLUMN IF NOT EXISTS sale_value_with_tax numeric;

CREATE OR REPLACE FUNCTION public.products_sync_tax_prices()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_pct numeric := 0;
BEGIN
  -- Resolve tax %
  IF NEW.tax_rate_id IS NOT NULL THEN
    SELECT COALESCE(percentage, 0) INTO v_pct FROM public.tax_rates WHERE id = NEW.tax_rate_id;
  ELSE
    SELECT COALESCE(percentage, 0) INTO v_pct
      FROM public.tax_rates
     WHERE is_default = true AND is_active = true
     LIMIT 1;
  END IF;
  v_pct := COALESCE(v_pct, 0);

  -- Base price sync: prefer explicit base_price when both arrive; otherwise derive from gross
  IF TG_OP = 'INSERT' THEN
    IF NEW.base_price IS NULL AND NEW.base_price_with_tax IS NOT NULL THEN
      NEW.base_price := ROUND( (NEW.base_price_with_tax / (1 + v_pct/100))::numeric, 4 );
    END IF;
    NEW.base_price_with_tax := ROUND( (COALESCE(NEW.base_price,0) * (1 + v_pct/100))::numeric, 4 );
  ELSE
    -- UPDATE: if base_price_with_tax changed but base_price didn't, derive net from gross
    IF NEW.base_price_with_tax IS DISTINCT FROM OLD.base_price_with_tax
       AND NEW.base_price IS NOT DISTINCT FROM OLD.base_price
       AND NEW.base_price_with_tax IS NOT NULL THEN
      NEW.base_price := ROUND( (NEW.base_price_with_tax / (1 + v_pct/100))::numeric, 4 );
    END IF;
    NEW.base_price_with_tax := ROUND( (COALESCE(NEW.base_price,0) * (1 + v_pct/100))::numeric, 4 );
  END IF;

  -- Sale value sync (only meaningful for fixed)
  IF NEW.sale_price_type = 'fixed' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.sale_value IS NULL AND NEW.sale_value_with_tax IS NOT NULL THEN
        NEW.sale_value := ROUND( (NEW.sale_value_with_tax / (1 + v_pct/100))::numeric, 4 );
      END IF;
      IF NEW.sale_value IS NOT NULL THEN
        NEW.sale_value_with_tax := ROUND( (NEW.sale_value * (1 + v_pct/100))::numeric, 4 );
      END IF;
    ELSE
      IF NEW.sale_value_with_tax IS DISTINCT FROM OLD.sale_value_with_tax
         AND NEW.sale_value IS NOT DISTINCT FROM OLD.sale_value
         AND NEW.sale_value_with_tax IS NOT NULL THEN
        NEW.sale_value := ROUND( (NEW.sale_value_with_tax / (1 + v_pct/100))::numeric, 4 );
      END IF;
      IF NEW.sale_value IS NOT NULL THEN
        NEW.sale_value_with_tax := ROUND( (NEW.sale_value * (1 + v_pct/100))::numeric, 4 );
      ELSE
        NEW.sale_value_with_tax := NULL;
      END IF;
    END IF;
  ELSE
    NEW.sale_value_with_tax := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_sync_tax_prices ON public.products;
CREATE TRIGGER trg_products_sync_tax_prices
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_sync_tax_prices();

-- Backfill: touch each row so the trigger computes the gross columns
UPDATE public.products SET base_price = base_price;

-- ============================================================
-- 2) ROLE SYSTEM: app_role enum + user_roles + helpers
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('super_admin','admin','customer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$$;

-- Reescriu is_admin perquè cobreixi també super_admin i la nova taula
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin'))
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND role = 'admin')
$$;

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins manage roles" ON public.user_roles;
CREATE POLICY "Super admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Seed: copy existing profile admins into user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::public.app_role
  FROM public.profiles p
 WHERE p.role = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;

-- Promote default super admin
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'super_admin'::public.app_role
  FROM auth.users u
 WHERE lower(u.email) = 'admin@elmussolet.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================
-- 3) PERMISSIONS: app_permission enum + user_permissions
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.app_permission AS ENUM (
    'ai_features',
    'manage_backups',
    'manage_users',
    'manage_cookies',
    'manage_smtp',
    'manage_translations'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission public.app_permission NOT NULL,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);

GRANT SELECT ON public.user_permissions TO authenticated;
GRANT ALL ON public.user_permissions TO service_role;

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own permissions" ON public.user_permissions;
CREATE POLICY "Users read own permissions" ON public.user_permissions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins manage permissions" ON public.user_permissions;
CREATE POLICY "Super admins manage permissions" ON public.user_permissions
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Permission enforcement flag (off by default → admins keep all access)
INSERT INTO public.site_settings (key, value)
VALUES ('permissions_enforced', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_permissions_enforced()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (value)::text::boolean FROM public.site_settings WHERE key = 'permissions_enforced'),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _perm public.app_permission)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR (
      public.is_admin(_user_id) AND (
        NOT public.is_permissions_enforced()
        OR EXISTS (
          SELECT 1 FROM public.user_permissions
           WHERE user_id = _user_id AND permission = _perm
        )
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, public.app_permission) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_permissions_enforced() TO anon, authenticated;

-- ============================================================
-- 4) RPC: top products by period (admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_top_products(_from timestamptz, _to timestamptz, _limit int DEFAULT 10)
RETURNS TABLE (product_id uuid, slug text, units bigint, revenue numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  RETURN QUERY
    SELECT
      p.id AS product_id,
      p.slug,
      SUM(oi.quantity)::bigint AS units,
      COALESCE(SUM(oi.quantity * oi.unit_price), 0)::numeric AS revenue
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    JOIN public.products p ON p.id = oi.product_id
   WHERE o.created_at >= _from
     AND o.created_at < _to
     AND o.status NOT IN ('cancelled','refunded')
   GROUP BY p.id, p.slug
   ORDER BY units DESC
   LIMIT _limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_products(timestamptz, timestamptz, int) TO authenticated;
