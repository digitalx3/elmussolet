
-- 1. Fix birth_lists INSERT policy: trigger always sets created_by, so just require authenticated
DROP POLICY IF EXISTS "Authenticated users can create lists" ON public.birth_lists;
CREATE POLICY "Authenticated users can create lists"
  ON public.birth_lists FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 2. Drop the rigid orders.status check constraint (order_statuses table is the source of truth)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- 3. CMS blocks table for legal pages + editable home sections
CREATE TABLE public.cms_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('page','home_feature','home_cta')),
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  title_ca text,
  title_es text,
  subtitle_ca text,
  subtitle_es text,
  content_ca text,
  content_es text,
  cta_label_ca text,
  cta_label_es text,
  cta_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cms_blocks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cms_blocks TO authenticated;
GRANT ALL ON public.cms_blocks TO service_role;

ALTER TABLE public.cms_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active cms blocks"
  ON public.cms_blocks FOR SELECT
  USING (is_active = true OR public.is_admin(auth.uid()));

CREATE POLICY "Admins manage cms blocks"
  ON public.cms_blocks FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_cms_blocks_updated_at
  BEFORE UPDATE ON public.cms_blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed legal / info pages
INSERT INTO public.cms_blocks (slug, kind, sort_order, title_ca, title_es, content_ca, content_es) VALUES
  ('avis-legal', 'page', 1, 'Avís legal', 'Aviso legal',
   '<h2>Avís legal</h2><p>Edita aquest contingut des de l''administració.</p>',
   '<h2>Aviso legal</h2><p>Edita este contenido desde la administración.</p>'),
  ('privacitat', 'page', 2, 'Política de privacitat', 'Política de privacidad',
   '<h2>Política de privacitat</h2><p>Edita aquest contingut des de l''administració.</p>',
   '<h2>Política de privacidad</h2><p>Edita este contenido desde la administración.</p>'),
  ('cookies', 'page', 3, 'Política de cookies', 'Política de cookies',
   '<h2>Política de cookies</h2><p>Edita aquest contingut des de l''administració.</p>',
   '<h2>Política de cookies</h2><p>Edita este contenido desde la administración.</p>'),
  ('condicions', 'page', 4, 'Condicions de venda', 'Condiciones de venta',
   '<h2>Condicions de venda</h2><p>Edita aquest contingut des de l''administració.</p>',
   '<h2>Condiciones de venta</h2><p>Edita este contenido desde la administración.</p>'),
  ('enviaments-devolucions', 'page', 5, 'Enviaments i devolucions', 'Envíos y devoluciones',
   '<h2>Enviaments i devolucions</h2><p>Edita aquest contingut des de l''administració.</p>',
   '<h2>Envíos y devoluciones</h2><p>Edita este contenido desde la administración.</p>');

-- Seed home feature cards
INSERT INTO public.cms_blocks (slug, kind, sort_order, icon, title_ca, title_es, subtitle_ca, subtitle_es) VALUES
  ('home-feature-shipping', 'home_feature', 1, 'Package',
    'Enviament segur', 'Envío seguro',
    'Enviament ràpid i segur a tota la península.', 'Envío rápido y seguro a toda la península.'),
  ('home-feature-pickup', 'home_feature', 2, 'Store',
    'Recollida a botiga', 'Recogida en tienda',
    'Recull la teva comanda a la botiga sense cost.', 'Recoge tu pedido en la tienda sin coste.'),
  ('home-feature-attention', 'home_feature', 3, 'Heart',
    'Atenció personalitzada', 'Atención personalizada',
    'T''assessorem personalment per triar el millor.', 'Te asesoramos personalmente para elegir lo mejor.');

-- Seed birth list CTA block
INSERT INTO public.cms_blocks (slug, kind, sort_order, title_ca, title_es, subtitle_ca, subtitle_es, cta_label_ca, cta_label_es, cta_url) VALUES
  ('home-birthlist-cta', 'home_cta', 1,
   'Llistes de Naixement', 'Listas de Nacimiento',
   'Crea la teva llista de naixement i comparteix-la amb familiars i amics. Sense duplicats, sense maldecaps.',
   'Crea tu lista de nacimiento y compártela con familiares y amigos. Sin duplicados, sin complicaciones.',
   'Crear llista', 'Crear lista', '/la-meva-llista');
