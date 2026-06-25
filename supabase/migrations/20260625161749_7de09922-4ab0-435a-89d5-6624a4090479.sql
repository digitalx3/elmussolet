
-- =========================
-- COOKIE CATEGORIES
-- =========================
CREATE TABLE public.cookie_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  is_required boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  name_ca text NOT NULL,
  name_es text NOT NULL,
  description_ca text NOT NULL DEFAULT '',
  description_es text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cookie_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cookie_categories TO authenticated;
GRANT ALL ON public.cookie_categories TO service_role;

ALTER TABLE public.cookie_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cookie categories are publicly readable"
  ON public.cookie_categories FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage cookie categories"
  ON public.cookie_categories FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_cookie_categories_updated
  BEFORE UPDATE ON public.cookie_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- COOKIE REGISTRY
-- =========================
CREATE TABLE public.cookies_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  provider text NOT NULL DEFAULT '',
  category_id uuid NOT NULL REFERENCES public.cookie_categories(id) ON DELETE CASCADE,
  purpose_ca text NOT NULL DEFAULT '',
  purpose_es text NOT NULL DEFAULT '',
  duration text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'first_party' CHECK (type IN ('first_party','third_party')),
  requires_consent boolean NOT NULL DEFAULT true,
  service text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cookies_registry_category_idx ON public.cookies_registry(category_id);

GRANT SELECT ON public.cookies_registry TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cookies_registry TO authenticated;
GRANT ALL ON public.cookies_registry TO service_role;

ALTER TABLE public.cookies_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cookies registry is publicly readable"
  ON public.cookies_registry FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage cookies registry"
  ON public.cookies_registry FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_cookies_registry_updated
  BEFORE UPDATE ON public.cookies_registry
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- COOKIE SETTINGS (singleton)
-- =========================
CREATE TABLE public.cookie_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  policy_version integer NOT NULL DEFAULT 1,
  ga_enabled boolean NOT NULL DEFAULT false,
  ga_measurement_id text NOT NULL DEFAULT '',
  maps_requires_consent boolean NOT NULL DEFAULT true,
  banner_text_ca text NOT NULL DEFAULT 'Aquest lloc utilitza cookies pròpies i de tercers per millorar la teva experiència. Pots acceptar-les totes, rebutjar-les o configurar-les.',
  banner_text_es text NOT NULL DEFAULT 'Este sitio utiliza cookies propias y de terceros para mejorar tu experiencia. Puedes aceptarlas todas, rechazarlas o configurarlas.',
  banner_text_short_ca text NOT NULL DEFAULT 'Utilitzem cookies per millorar la teva experiència.',
  banner_text_short_es text NOT NULL DEFAULT 'Usamos cookies para mejorar tu experiencia.',
  policy_url text NOT NULL DEFAULT '/politica-cookies',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cookie_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cookie_settings TO authenticated;
GRANT ALL ON public.cookie_settings TO service_role;

ALTER TABLE public.cookie_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cookie settings are publicly readable"
  ON public.cookie_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage cookie settings"
  ON public.cookie_settings FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER trg_cookie_settings_updated
  BEFORE UPDATE ON public.cookie_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- COOKIE CONSENT LOG (auditable, append-only)
-- =========================
CREATE TABLE public.cookie_consent_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id text NOT NULL,
  user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  consent jsonb NOT NULL,
  policy_version integer NOT NULL DEFAULT 1,
  user_agent text NOT NULL DEFAULT '',
  ip_hash text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'banner',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cookie_consent_log_anon_idx ON public.cookie_consent_log(anon_id);
CREATE INDEX cookie_consent_log_user_idx ON public.cookie_consent_log(user_id);
CREATE INDEX cookie_consent_log_created_idx ON public.cookie_consent_log(created_at DESC);

GRANT INSERT ON public.cookie_consent_log TO anon, authenticated;
GRANT SELECT ON public.cookie_consent_log TO authenticated;
GRANT ALL ON public.cookie_consent_log TO service_role;

ALTER TABLE public.cookie_consent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log their consent"
  ON public.cookie_consent_log FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins view consent log"
  ON public.cookie_consent_log FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- =========================
-- SEED
-- =========================
INSERT INTO public.cookie_settings (singleton) VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

INSERT INTO public.cookie_categories (key, is_required, is_enabled, sort_order, name_ca, name_es, description_ca, description_es) VALUES
  ('necessary',   true,  true, 10, 'Necessàries',  'Necesarias',  'Imprescindibles per al funcionament bàsic del lloc (sessió, carret, preferències).', 'Imprescindibles para el funcionamiento básico del sitio (sesión, carrito, preferencias).'),
  ('functional',  false, true, 20, 'Funcionals',   'Funcionales', 'Milloren funcionalitats i personalització, però no són estrictament necessàries.',     'Mejoran funcionalidades y personalización, pero no son estrictamente necesarias.'),
  ('analytics',   false, true, 30, 'Analítiques',  'Analíticas',  'Ens permeten mesurar el trànsit i l''ús del lloc per millorar-lo (p. ex. Google Analytics).', 'Nos permiten medir el tráfico y el uso del sitio para mejorarlo (p. ej. Google Analytics).'),
  ('marketing',   false, false, 40, 'Màrqueting',  'Marketing',   'S''utilitzen per mostrar publicitat rellevant.',                                       'Se utilizan para mostrar publicidad relevante.'),
  ('third_party', false, true, 50, 'Tercers',      'Terceros',    'Serveis externs incrustats al lloc (p. ex. Google Maps, YouTube).',                  'Servicios externos integrados en el sitio (p. ej. Google Maps, YouTube).');

INSERT INTO public.cookies_registry (name, provider, category_id, purpose_ca, purpose_es, duration, type, requires_consent, service, sort_order)
SELECT 'sb-*-auth-token', 'Supabase', c.id,
  'Manté la sessió iniciada de l''usuari.', 'Mantiene la sesión iniciada del usuario.',
  '1 any', 'first_party', false, 'auth', 10
FROM public.cookie_categories c WHERE c.key = 'necessary';

INSERT INTO public.cookies_registry (name, provider, category_id, purpose_ca, purpose_es, duration, type, requires_consent, service, sort_order)
SELECT 'cart', 'El Mussolet', c.id,
  'Desa els productes del carret de la compra.', 'Guarda los productos del carrito de la compra.',
  'Persistent', 'first_party', false, 'cart', 20
FROM public.cookie_categories c WHERE c.key = 'necessary';

INSERT INTO public.cookies_registry (name, provider, category_id, purpose_ca, purpose_es, duration, type, requires_consent, service, sort_order)
SELECT 'cookie_consent', 'El Mussolet', c.id,
  'Desa les preferències de consentiment de cookies.', 'Guarda las preferencias de consentimiento de cookies.',
  '12 mesos', 'first_party', false, 'consent', 30
FROM public.cookie_categories c WHERE c.key = 'necessary';

INSERT INTO public.cookies_registry (name, provider, category_id, purpose_ca, purpose_es, duration, type, requires_consent, service, sort_order)
SELECT 'i18nextLng', 'El Mussolet', c.id,
  'Recorda l''idioma preferit de l''usuari.', 'Recuerda el idioma preferido del usuario.',
  'Persistent', 'first_party', true, 'preferences', 10
FROM public.cookie_categories c WHERE c.key = 'functional';

INSERT INTO public.cookies_registry (name, provider, category_id, purpose_ca, purpose_es, duration, type, requires_consent, service, sort_order)
SELECT '_ga, _ga_*', 'Google', c.id,
  'Identifica usuaris únics i mesura l''ús del lloc.', 'Identifica usuarios únicos y mide el uso del sitio.',
  '2 anys', 'third_party', true, 'google-analytics', 10
FROM public.cookie_categories c WHERE c.key = 'analytics';

INSERT INTO public.cookies_registry (name, provider, category_id, purpose_ca, purpose_es, duration, type, requires_consent, service, sort_order)
SELECT 'NID, SID, etc.', 'Google Maps', c.id,
  'Permet la incrustació del mapa de Google Maps.', 'Permite la incrustación del mapa de Google Maps.',
  'Sessió / 6 mesos', 'third_party', true, 'google-maps', 10
FROM public.cookie_categories c WHERE c.key = 'third_party';
