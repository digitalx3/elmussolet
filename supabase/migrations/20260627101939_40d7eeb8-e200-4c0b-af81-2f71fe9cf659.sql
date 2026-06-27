CREATE OR REPLACE FUNCTION public.validate_replacement_product()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF NEW.replacement_product_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.stock_status IS DISTINCT FROM 'discontinued' THEN
    RAISE EXCEPTION 'REPLACEMENT_ONLY_WHEN_DISCONTINUED'
      USING HINT = 'replacement_product_id can only be set when stock_status = discontinued';
  END IF;

  IF NEW.replacement_product_id = NEW.id THEN
    RAISE EXCEPTION 'REPLACEMENT_CANNOT_BE_SELF';
  END IF;

  SELECT id, is_active, stock_status INTO r
    FROM public.products
   WHERE id = NEW.replacement_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REPLACEMENT_PRODUCT_NOT_FOUND';
  END IF;

  IF r.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'REPLACEMENT_PRODUCT_INACTIVE';
  END IF;

  IF r.stock_status = 'discontinued' THEN
    RAISE EXCEPTION 'REPLACEMENT_PRODUCT_DISCONTINUED';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_replacement_product ON public.products;
CREATE TRIGGER trg_validate_replacement_product
BEFORE INSERT OR UPDATE OF replacement_product_id, stock_status
ON public.products
FOR EACH ROW EXECUTE FUNCTION public.validate_replacement_product();