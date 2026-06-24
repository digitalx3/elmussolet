
DROP POLICY IF EXISTS "Owners and admins can view list items" ON public.list_items;
CREATE POLICY "Authenticated users can view list items"
ON public.list_items
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Owners and admins can view list sections" ON public.list_sections;
CREATE POLICY "Authenticated users can view list sections"
ON public.list_sections
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);
