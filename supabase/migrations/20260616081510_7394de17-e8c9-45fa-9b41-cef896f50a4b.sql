
-- Ensure grants exist (no-op if already granted)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.birth_lists TO authenticated;
GRANT ALL ON public.birth_lists TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_owners TO authenticated;
GRANT ALL ON public.list_owners TO service_role;

-- Trigger to force created_by = auth.uid() on insert so the RLS WITH CHECK
-- always passes for any signed-in user, regardless of what the client sent.
CREATE OR REPLACE FUNCTION public.set_birth_list_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_birth_list_created_by ON public.birth_lists;
CREATE TRIGGER trg_set_birth_list_created_by
  BEFORE INSERT ON public.birth_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.set_birth_list_created_by();
