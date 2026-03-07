
-- Fix recursive list_owners SELECT policy
DROP POLICY IF EXISTS "Users can view own list owners" ON public.list_owners;

-- Use a security definer function to avoid recursion
CREATE OR REPLACE FUNCTION public.user_owns_list(_list_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.list_owners
    WHERE list_id = _list_id AND user_id = _user_id
  )
$$;

CREATE POLICY "Users can view own list owners" ON public.list_owners
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.user_owns_list(list_id, auth.uid()));
