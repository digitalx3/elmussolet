CREATE OR REPLACE FUNCTION public.guard_replacement_referenced()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_count integer;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Only check when becoming inactive or discontinued
  IF (NEW.is_active = false AND OLD.is_active = true)
     OR (NEW.stock_status = 'discontinued' AND OLD.stock_status IS DISTINCT FROM 'discontinued') THEN

    SELECT count(*) INTO ref_count
      FROM public.products
     WHERE replacement_product_id = NEW.id
       AND id <> NEW.id;

    IF ref_count > 0 THEN
      RAISE EXCEPTION 'REPLACEMENT_IN_USE'
        USING HINT = format('Aquest producte és utilitzat com a substitut per %s producte(s). Reassigna-los abans de desactivar-lo o descatalogar-lo.', ref_count);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_replacement_referenced ON public.products;
CREATE TRIGGER trg_guard_replacement_referenced
BEFORE UPDATE OF is_active, stock_status
ON public.products
FOR EACH ROW EXECUTE FUNCTION public.guard_replacement_referenced();