
ALTER TABLE public.order_items
  ADD COLUMN base_unit_price numeric,
  ADD COLUMN tax_percentage numeric DEFAULT 0,
  ADD COLUMN tax_amount numeric DEFAULT 0;

COMMENT ON COLUMN public.order_items.base_unit_price IS 'Unit price before tax';
COMMENT ON COLUMN public.order_items.tax_percentage IS 'Tax rate percentage applied to this item';
COMMENT ON COLUMN public.order_items.tax_amount IS 'Total tax amount for this line (qty * base * tax_pct/100)';
