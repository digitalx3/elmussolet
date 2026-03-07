
-- Fix birth_lists owner policies to use security definer function
DROP POLICY IF EXISTS "Owners can update their lists" ON public.birth_lists;
DROP POLICY IF EXISTS "Owners can view their lists" ON public.birth_lists;

CREATE POLICY "Owners can view their lists" ON public.birth_lists
  FOR SELECT TO authenticated
  USING (public.user_owns_list(id, auth.uid()));

CREATE POLICY "Owners can update their lists" ON public.birth_lists
  FOR UPDATE TO authenticated
  USING (public.user_owns_list(id, auth.uid()));

-- Fix list_items owner policy too
DROP POLICY IF EXISTS "Owners can manage list items" ON public.list_items;

CREATE POLICY "Owners can manage list items" ON public.list_items
  FOR ALL TO authenticated
  USING (public.user_owns_list(list_id, auth.uid()))
  WITH CHECK (public.user_owns_list(list_id, auth.uid()));
