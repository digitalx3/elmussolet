CREATE POLICY "Creators can view their lists"
ON public.birth_lists
FOR SELECT
TO authenticated
USING (created_by = auth.uid());