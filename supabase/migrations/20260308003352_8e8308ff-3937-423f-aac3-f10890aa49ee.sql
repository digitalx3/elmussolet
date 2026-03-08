
-- Create tax_rates table
CREATE TABLE public.tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  percentage numeric NOT NULL DEFAULT 21,
  country_code text NOT NULL DEFAULT 'ES',
  region text,
  is_default boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tax rates" ON public.tax_rates FOR SELECT USING (true);
CREATE POLICY "Admins can manage tax rates" ON public.tax_rates FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Add tax_rate_id to products
ALTER TABLE public.products ADD COLUMN tax_rate_id uuid REFERENCES public.tax_rates(id) ON DELETE SET NULL;

-- Add tax_amount to orders
ALTER TABLE public.orders ADD COLUMN tax_amount numeric DEFAULT 0;

-- Seed default Spanish tax rates
INSERT INTO public.tax_rates (name, percentage, country_code, region, is_default) VALUES
  ('IVA General', 21, 'ES', NULL, true),
  ('IVA Reduït', 10, 'ES', NULL, false),
  ('IVA Superreduït', 4, 'ES', NULL, false),
  ('Exempt', 0, 'ES', NULL, false),
  ('IGIC General', 7, 'ES', 'Canàries', false),
  ('IGIC Reduït', 3, 'ES', 'Canàries', false);
