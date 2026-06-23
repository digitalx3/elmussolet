DROP POLICY IF EXISTS "Owners can view their lists" ON public.birth_lists;
CREATE POLICY "Owners can view their lists"
ON public.birth_lists
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.list_owners lo
    WHERE lo.list_id = birth_lists.id
      AND lo.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view own list owners" ON public.list_owners;
CREATE POLICY "Users can view own list owners"
ON public.list_owners
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.list_owners owner_row
    WHERE owner_row.list_id = list_owners.list_id
      AND owner_row.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert list owners for their lists" ON public.list_owners;
CREATE POLICY "Users can insert list owners for their lists"
ON public.list_owners
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.birth_lists bl
    WHERE bl.id = list_owners.list_id
      AND bl.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can update their list owner details" ON public.list_owners;
CREATE POLICY "Owners can update their list owner details"
ON public.list_owners
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.birth_lists bl
    WHERE bl.id = list_owners.list_id
      AND bl.created_by = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.birth_lists bl
    WHERE bl.id = list_owners.list_id
      AND bl.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Owners can delete their list owner details" ON public.list_owners;
CREATE POLICY "Owners can delete their list owner details"
ON public.list_owners
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.birth_lists bl
    WHERE bl.id = list_owners.list_id
      AND bl.created_by = auth.uid()
  )
);