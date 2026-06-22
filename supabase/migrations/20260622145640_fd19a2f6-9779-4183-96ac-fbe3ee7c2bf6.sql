CREATE OR REPLACE FUNCTION public.enforce_birth_list_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cnt int;
BEGIN
  IF uid IS NULL OR public.is_admin(uid) THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO cnt FROM public.list_owners WHERE user_id = uid;
  IF cnt >= 10 THEN
    RAISE EXCEPTION 'BIRTH_LIST_LIMIT_REACHED' USING HINT = 'Max 10 lists per user';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS birth_lists_enforce_limit ON public.birth_lists;
CREATE TRIGGER birth_lists_enforce_limit
BEFORE INSERT ON public.birth_lists
FOR EACH ROW EXECUTE FUNCTION public.enforce_birth_list_limit();