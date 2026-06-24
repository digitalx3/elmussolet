
-- 1) list_items: restrict SELECT to owners/admin (authenticated only)
DROP POLICY IF EXISTS "Anyone can view list items" ON public.list_items;
CREATE POLICY "Owners and admins can view list items"
ON public.list_items
FOR SELECT
TO authenticated
USING (public.user_owns_list(list_id, auth.uid()) OR public.is_admin(auth.uid()));

-- 2) list_sections: same restriction
DROP POLICY IF EXISTS "Anyone can view list sections" ON public.list_sections;
CREATE POLICY "Owners and admins can view list sections"
ON public.list_sections
FOR SELECT
TO authenticated
USING (public.user_owns_list(list_id, auth.uid()) OR public.is_admin(auth.uid()));

-- 3) order_status_email_templates: admin-only read
DROP POLICY IF EXISTS "Anyone can view order status email templates" ON public.order_status_email_templates;
CREATE POLICY "Admins can view order status email templates"
ON public.order_status_email_templates
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- 4) profiles: prevent self role escalation
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- Also attach the existing prevent_self_role_escalation trigger as a defense in depth
DROP TRIGGER IF EXISTS prevent_self_role_escalation_trg ON public.profiles;
CREATE TRIGGER prevent_self_role_escalation_trg
BEFORE UPDATE OF role ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_escalation();

-- 5) contact_messages: replace WITH CHECK (true) with basic validation
DROP POLICY IF EXISTS "Anyone can submit contact messages" ON public.contact_messages;
CREATE POLICY "Anyone can submit contact messages"
ON public.contact_messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(btrim(coalesce(name, ''))) > 0
  AND length(btrim(coalesce(email, ''))) > 0
  AND length(btrim(coalesce(message, ''))) > 0
  AND is_read = false
);

-- 6) storage: prevent public listing while keeping public file URLs working
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
DROP POLICY IF EXISTS "Public read site assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read brand logos" ON storage.objects;
-- (public buckets continue to serve objects via direct URL without RLS)

-- 7) SECURITY DEFINER functions: revoke EXECUTE from public/anon/authenticated
--    Trigger / internal-only functions
REVOKE EXECUTE ON FUNCTION public.apply_order_item_stock_delta(uuid,uuid,uuid,integer,uuid,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_birth_list_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.order_items_stock_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orders_status_stock_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_self_role_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_birth_list_created_by() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

--    Helpers used inside RLS only (RLS evaluation runs as table owner, so we can revoke from anon/authenticated)
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_owns_list(uuid, uuid) FROM PUBLIC, anon;

--    Public-facing RPCs: keep accessible to authenticated only
REVOKE EXECUTE ON FUNCTION public.get_list_purchases(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_list_block_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_list_purchases(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_list_block_summary(uuid) TO authenticated;
