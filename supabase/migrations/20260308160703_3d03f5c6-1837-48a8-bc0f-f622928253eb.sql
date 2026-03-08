
-- Order statuses table
CREATE TABLE public.order_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#6b7280',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true
);

ALTER TABLE public.order_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage order statuses" ON public.order_statuses FOR ALL
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Anyone can view order statuses" ON public.order_statuses FOR SELECT
  USING (true);

-- Order status translations
CREATE TABLE public.order_status_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL REFERENCES public.order_statuses(id) ON DELETE CASCADE,
  language text NOT NULL,
  name text NOT NULL,
  UNIQUE(status_id, language)
);

ALTER TABLE public.order_status_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage order status translations" ON public.order_status_translations FOR ALL
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Anyone can view order status translations" ON public.order_status_translations FOR SELECT
  USING (true);

-- Order status email templates
CREATE TABLE public.order_status_email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status_id uuid NOT NULL REFERENCES public.order_statuses(id) ON DELETE CASCADE,
  language text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  UNIQUE(status_id, language)
);

ALTER TABLE public.order_status_email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage order status email templates" ON public.order_status_email_templates FOR ALL
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Anyone can view order status email templates" ON public.order_status_email_templates FOR SELECT
  USING (true);
