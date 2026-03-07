
-- Fix birth_lists RLS: drop RESTRICTIVE policies and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Admins can manage all lists" ON public.birth_lists;
DROP POLICY IF EXISTS "Authenticated users can create lists" ON public.birth_lists;
DROP POLICY IF EXISTS "Owners can update their lists" ON public.birth_lists;
DROP POLICY IF EXISTS "Owners can view their lists" ON public.birth_lists;

CREATE POLICY "Admins can manage all lists" ON public.birth_lists
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated users can create lists" ON public.birth_lists
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owners can update their lists" ON public.birth_lists
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM list_owners WHERE list_owners.list_id = birth_lists.id AND list_owners.user_id = auth.uid()));

CREATE POLICY "Owners can view their lists" ON public.birth_lists
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM list_owners WHERE list_owners.list_id = birth_lists.id AND list_owners.user_id = auth.uid()));

-- Fix list_owners RLS
DROP POLICY IF EXISTS "Admins can manage list owners" ON public.list_owners;
DROP POLICY IF EXISTS "Users can insert list owners for their lists" ON public.list_owners;
DROP POLICY IF EXISTS "Users can view own list owners" ON public.list_owners;

CREATE POLICY "Admins can manage list owners" ON public.list_owners
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Users can insert list owners for their lists" ON public.list_owners
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM birth_lists WHERE birth_lists.id = list_owners.list_id AND birth_lists.created_by = auth.uid())
    OR user_id = auth.uid()
  );

CREATE POLICY "Users can view own list owners" ON public.list_owners
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM list_owners lo2 WHERE lo2.list_id = list_owners.list_id AND lo2.user_id = auth.uid()));

-- Fix list_items RLS
DROP POLICY IF EXISTS "Admins can manage list items" ON public.list_items;
DROP POLICY IF EXISTS "Authenticated can view list items" ON public.list_items;
DROP POLICY IF EXISTS "Owners can manage list items" ON public.list_items;

CREATE POLICY "Admins can manage list items" ON public.list_items
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated can view list items" ON public.list_items
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Owners can manage list items" ON public.list_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM list_owners WHERE list_owners.list_id = list_items.list_id AND list_owners.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM list_owners WHERE list_owners.list_id = list_items.list_id AND list_owners.user_id = auth.uid()));
