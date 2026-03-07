
-- Timestamp update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1. profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postal_code TEXT,
  province TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'ca',
  role TEXT NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  parent_id UUID REFERENCES public.categories(id),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. category_translations
CREATE TABLE public.category_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('ca', 'es')),
  name TEXT NOT NULL,
  description TEXT,
  UNIQUE(category_id, language)
);
ALTER TABLE public.category_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view category translations" ON public.category_translations FOR SELECT USING (true);
CREATE POLICY "Admins can manage category translations" ON public.category_translations FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 4. brands
CREATE TABLE public.brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true
);
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view brands" ON public.brands FOR SELECT USING (true);
CREATE POLICY "Admins can manage brands" ON public.brands FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 5. products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  brand_id UUID REFERENCES public.brands(id),
  category_id UUID REFERENCES public.categories(id),
  base_price NUMERIC(10,2) NOT NULL,
  weight_grams INT DEFAULT 0,
  stock_quantity INT DEFAULT 0,
  stock_status TEXT DEFAULT 'in_stock' CHECK (stock_status IN ('in_stock', 'on_order', 'out_of_stock')),
  is_active BOOLEAN DEFAULT true,
  has_variants BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admins can manage products" ON public.products FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. product_translations
CREATE TABLE public.product_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('ca', 'es')),
  name TEXT NOT NULL,
  short_description TEXT,
  description TEXT NOT NULL,
  UNIQUE(product_id, language)
);
ALTER TABLE public.product_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view product translations" ON public.product_translations FOR SELECT USING (true);
CREATE POLICY "Admins can manage product translations" ON public.product_translations FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 7. product_images
CREATE TABLE public.product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  alt_text TEXT,
  sort_order INT DEFAULT 0,
  is_primary BOOLEAN DEFAULT false
);
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view product images" ON public.product_images FOR SELECT USING (true);
CREATE POLICY "Admins can manage product images" ON public.product_images FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 8. variant_types
CREATE TABLE public.variant_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL
);
ALTER TABLE public.variant_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view variant types" ON public.variant_types FOR SELECT USING (true);
CREATE POLICY "Admins can manage variant types" ON public.variant_types FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 9. variant_type_translations
CREATE TABLE public.variant_type_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_type_id UUID NOT NULL REFERENCES public.variant_types(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('ca', 'es')),
  name TEXT NOT NULL,
  UNIQUE(variant_type_id, language)
);
ALTER TABLE public.variant_type_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view variant type translations" ON public.variant_type_translations FOR SELECT USING (true);
CREATE POLICY "Admins can manage variant type translations" ON public.variant_type_translations FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 10. product_variants
CREATE TABLE public.product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_type_id UUID NOT NULL REFERENCES public.variant_types(id),
  value TEXT NOT NULL,
  price_override NUMERIC(10,2),
  stock_quantity INT DEFAULT 0,
  sku_suffix TEXT,
  is_active BOOLEAN DEFAULT true
);
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view product variants" ON public.product_variants FOR SELECT USING (true);
CREATE POLICY "Admins can manage product variants" ON public.product_variants FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 11. list_templates
CREATE TABLE public.list_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.list_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active templates" ON public.list_templates FOR SELECT USING (true);
CREATE POLICY "Admins can manage templates" ON public.list_templates FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 12. list_template_translations
CREATE TABLE public.list_template_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.list_templates(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (language IN ('ca', 'es')),
  name TEXT NOT NULL,
  description TEXT,
  UNIQUE(template_id, language)
);
ALTER TABLE public.list_template_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view template translations" ON public.list_template_translations FOR SELECT USING (true);
CREATE POLICY "Admins can manage template translations" ON public.list_template_translations FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 13. list_template_items
CREATE TABLE public.list_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.list_templates(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  quantity INT DEFAULT 1,
  sort_order INT DEFAULT 0
);
ALTER TABLE public.list_template_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view template items" ON public.list_template_items FOR SELECT USING (true);
CREATE POLICY "Admins can manage template items" ON public.list_template_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 14. birth_lists
CREATE TABLE public.birth_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_code TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'closed', 'archived')),
  baby_name TEXT,
  expected_date DATE,
  template_id UUID REFERENCES public.list_templates(id),
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.birth_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all lists" ON public.birth_lists FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Authenticated users can create lists" ON public.birth_lists FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE TRIGGER update_birth_lists_updated_at BEFORE UPDATE ON public.birth_lists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 15. list_owners (BEFORE birth_lists RLS that references it)
CREATE TABLE public.list_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.birth_lists(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false
);
ALTER TABLE public.list_owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage list owners" ON public.list_owners FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Users can view own list owners" ON public.list_owners FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.list_owners lo2 WHERE lo2.list_id = list_owners.list_id AND lo2.user_id = auth.uid()
  )
);
CREATE POLICY "Users can insert list owners for their lists" ON public.list_owners FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.birth_lists WHERE id = list_id AND created_by = auth.uid())
  OR user_id = auth.uid()
);

-- Now add owner-based RLS to birth_lists
CREATE POLICY "Owners can view their lists" ON public.birth_lists FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.list_owners WHERE list_id = id AND user_id = auth.uid())
);
CREATE POLICY "Owners can update their lists" ON public.birth_lists FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.list_owners WHERE list_id = id AND user_id = auth.uid())
);

-- 16. list_items
CREATE TABLE public.list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES public.birth_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  quantity_desired INT DEFAULT 1,
  quantity_purchased INT DEFAULT 0,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  sort_order INT DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage list items" ON public.list_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Owners can manage list items" ON public.list_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.list_owners WHERE list_id = list_items.list_id AND user_id = auth.uid())
);
CREATE POLICY "Authenticated can view list items" ON public.list_items FOR SELECT TO authenticated USING (true);

-- 17. orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  list_id UUID REFERENCES public.birth_lists(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_method TEXT CHECK (payment_method IN ('stripe', 'redsys', 'bank_transfer')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_reference TEXT,
  delivery_method TEXT CHECK (delivery_method IN ('pickup', 'shipping_buyer', 'shipping_owners')),
  shipping_cost NUMERIC(10,2) DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  shipping_address JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can create orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can manage all orders" ON public.orders FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 18. order_items
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  variant_id UUID REFERENCES public.product_variants(id),
  list_item_id UUID REFERENCES public.list_items(id),
  quantity INT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  total_price NUMERIC(10,2) NOT NULL
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own order items" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND user_id = auth.uid())
);
CREATE POLICY "Users can create order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND user_id = auth.uid())
);
CREATE POLICY "Admins can manage all order items" ON public.order_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 19. shipping_zones
CREATE TABLE public.shipping_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  postal_code_pattern TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0
);
ALTER TABLE public.shipping_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view shipping zones" ON public.shipping_zones FOR SELECT USING (true);
CREATE POLICY "Admins can manage shipping zones" ON public.shipping_zones FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 20. shipping_rates
CREATE TABLE public.shipping_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES public.shipping_zones(id) ON DELETE CASCADE,
  min_weight_grams INT NOT NULL,
  max_weight_grams INT NOT NULL,
  price NUMERIC(10,2) NOT NULL
);
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view shipping rates" ON public.shipping_rates FOR SELECT USING (true);
CREATE POLICY "Admins can manage shipping rates" ON public.shipping_rates FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 21. site_settings
CREATE TABLE public.site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.site_settings FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Initial data
INSERT INTO public.site_settings (key, value) VALUES
  ('store_name', 'El Mussolet'),
  ('store_email', 'info@elmussolet.com'),
  ('default_language', 'ca');

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('brand-logos', 'brand-logos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('site-assets', 'site-assets', true);

CREATE POLICY "Public read product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Admin upload product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'product-images' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Public read brand logos" ON storage.objects FOR SELECT USING (bucket_id = 'brand-logos');
CREATE POLICY "Admin upload brand logos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'brand-logos' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Public read site assets" ON storage.objects FOR SELECT USING (bucket_id = 'site-assets');
CREATE POLICY "Admin upload site assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'site-assets' AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
