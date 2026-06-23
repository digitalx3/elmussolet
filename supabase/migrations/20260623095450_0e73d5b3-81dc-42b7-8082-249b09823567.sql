DROP POLICY IF EXISTS "Owners can view their lists" ON public.birth_lists;
CREATE POLICY "Owners can view their lists"
ON public.birth_lists
FOR SELECT
TO authenticated
USING (public.user_owns_list(id, auth.uid()));

DROP POLICY IF EXISTS "Users can view own list owners" ON public.list_owners;
CREATE POLICY "Users can view own list owners"
ON public.list_owners
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR public.user_owns_list(list_id, auth.uid())
);

DROP POLICY IF EXISTS "Owners can update their list owner details" ON public.list_owners;
CREATE POLICY "Owners can update their list owner details"
ON public.list_owners
FOR UPDATE
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.user_owns_list(list_id, auth.uid())
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR public.user_owns_list(list_id, auth.uid())
);

DROP POLICY IF EXISTS "Owners can delete their list owner details" ON public.list_owners;
CREATE POLICY "Owners can delete their list owner details"
ON public.list_owners
FOR DELETE
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.user_owns_list(list_id, auth.uid())
);