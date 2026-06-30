
CREATE OR REPLACE FUNCTION public.products_sync_tax_prices()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pct numeric := 0;
BEGIN
  IF NEW.tax_rate_id IS NOT NULL THEN
    SELECT COALESCE(percentage, 0) INTO v_pct FROM public.tax_rates WHERE id = NEW.tax_rate_id;
  ELSE
    SELECT COALESCE(percentage, 0) INTO v_pct
      FROM public.tax_rates
     WHERE is_default = true AND is_active = true
     LIMIT 1;
  END IF;
  v_pct := COALESCE(v_pct, 0);

  IF TG_OP = 'INSERT' THEN
    IF NEW.base_price IS NULL AND NEW.base_price_with_tax IS NOT NULL THEN
      NEW.base_price := ROUND((NEW.base_price_with_tax / (1 + v_pct/100))::numeric, 2);
    END IF;
    NEW.base_price := ROUND(COALESCE(NEW.base_price,0)::numeric, 2);
    NEW.base_price_with_tax := ROUND((COALESCE(NEW.base_price,0) * (1 + v_pct/100))::numeric, 2);
  ELSE
    IF NEW.base_price_with_tax IS DISTINCT FROM OLD.base_price_with_tax
       AND NEW.base_price IS NOT DISTINCT FROM OLD.base_price
       AND NEW.base_price_with_tax IS NOT NULL THEN
      NEW.base_price := ROUND((NEW.base_price_with_tax / (1 + v_pct/100))::numeric, 2);
    END IF;
    NEW.base_price := ROUND(COALESCE(NEW.base_price,0)::numeric, 2);
    NEW.base_price_with_tax := ROUND((COALESCE(NEW.base_price,0) * (1 + v_pct/100))::numeric, 2);
  END IF;

  IF NEW.sale_price_type = 'fixed' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.sale_value IS NULL AND NEW.sale_value_with_tax IS NOT NULL THEN
        NEW.sale_value := ROUND((NEW.sale_value_with_tax / (1 + v_pct/100))::numeric, 2);
      END IF;
      IF NEW.sale_value IS NOT NULL THEN
        NEW.sale_value := ROUND(NEW.sale_value::numeric, 2);
        NEW.sale_value_with_tax := ROUND((NEW.sale_value * (1 + v_pct/100))::numeric, 2);
      END IF;
    ELSE
      IF NEW.sale_value_with_tax IS DISTINCT FROM OLD.sale_value_with_tax
         AND NEW.sale_value IS NOT DISTINCT FROM OLD.sale_value
         AND NEW.sale_value_with_tax IS NOT NULL THEN
        NEW.sale_value := ROUND((NEW.sale_value_with_tax / (1 + v_pct/100))::numeric, 2);
      END IF;
      IF NEW.sale_value IS NOT NULL THEN
        NEW.sale_value := ROUND(NEW.sale_value::numeric, 2);
        NEW.sale_value_with_tax := ROUND((NEW.sale_value * (1 + v_pct/100))::numeric, 2);
      ELSE
        NEW.sale_value_with_tax := NULL;
      END IF;
    END IF;
  ELSE
    NEW.sale_value_with_tax := NULL;
  END IF;

  RETURN NEW;
END;
$function$;

-- Normalize any existing prices to 2 decimals
UPDATE public.products SET base_price = ROUND(base_price::numeric, 2) WHERE base_price IS NOT NULL;
