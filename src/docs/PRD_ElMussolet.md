# PRD — El Mussolet: Llistes de Naixement & Botiga Online

## 1. Visió General del Producte

**Producte:** Aplicació web a mida per a www.elmussolet.com
**Stack tecnològic:** Lovable (React + Vite + Tailwind + shadcn/ui) + Supabase (PostgreSQL, Auth, Storage, Edge Functions)
**Idiomes:** Català (per defecte) i Castellà
**Tipus:** SPA (Single Page Application) amb SSR-friendly routing

### 1.1 Problema que resol
El Mussolet és una botiga de puericultura que vol digitalitzar el seu servei de llistes de naixement, permetent que familiars i amics comprin regals d'una llista privada de manera organitzada, evitant duplicats i facilitant la gestió. Addicionalment, la plataforma funciona com a botiga online estàndard.

### 1.2 Usuaris i rols del sistema

**Només existeixen 2 rols reals a la base de dades** (`profiles.role`):

| Rol (BD) | Descripció |
|----------|-----------|
| **`customer`** | Qualsevol persona registrada a la plataforma |
| **`admin`** | Administrador de la plataforma (gestió completa) |

**Un únic usuari `customer` pot operar en diferents modes segons el context:**

| Mode d'ús | Descripció | Requereix |
|-----------|-----------|-----------|
| **Visitant** | Navega el catàleg, veu productes | Cap compte (no registrat) |
| **Comprador estàndard** | Compra productes solts com a botiga online normal | Registre + login |
| **Comprador de llista** | Accedeix a una llista privada amb ID + contrasenya i compra regals d'aquella llista | Registre + login + credencials de la llista (codi + contrasenya) |
| **Propietari de llista** | Ha creat una llista de naixement i la gestiona (afegir productes, veure progrés) | Registre + login + haver creat una llista |

**Important:** "Comprador de llista" NO és un rol diferent. És el mateix usuari `customer` que, en un moment donat, accedeix a una llista privada amb credencials temporals. L'accés a la llista es gestiona mitjançant un token de sessió temporal (`ListAccessContext`), no pas per un rol assignat. Un mateix usuari pot comprar productes solts un dia i comprar regals d'una llista un altre dia, sense cap canvi al seu compte.

---

## 2. Arquitectura Tècnica

### 2.1 Base de dades (Supabase PostgreSQL)

#### Taules principals

**`profiles`** — Extensió d'auth.users
- `id` (UUID, FK → auth.users)
- `full_name` (text)
- `phone` (text, nullable)
- `address_line1`, `address_line2`, `city`, `postal_code`, `province` (text, nullable)
- `preferred_language` (enum: 'ca', 'es' — default 'ca')
- `role` (enum: 'customer', 'admin' — default 'customer')
- `created_at`, `updated_at` (timestamptz)

**`categories`** — Categories de productes
- `id` (UUID, PK)
- `slug` (text, unique)
- `parent_id` (UUID, FK → categories, nullable)
- `sort_order` (int)
- `is_active` (boolean, default true)
- `created_at`, `updated_at`

**`category_translations`** — Traduccions de categories
- `id` (UUID, PK)
- `category_id` (UUID, FK → categories)
- `language` (enum: 'ca', 'es')
- `name` (text)
- `description` (text, nullable)
- UNIQUE(`category_id`, `language`)

**`brands`** — Marques
- `id` (UUID, PK)
- `name` (text)
- `logo_url` (text, nullable)
- `is_active` (boolean, default true)

**`products`** — Productes
- `id` (UUID, PK)
- `sku` (text, unique)
- `slug` (text, unique)
- `brand_id` (UUID, FK → brands, nullable)
- `category_id` (UUID, FK → categories, nullable)
- `base_price` (numeric(10,2))
- `weight_grams` (int)
- `stock_quantity` (int, default 0)
- `stock_status` (enum: 'in_stock', 'on_order', 'out_of_stock')
- `is_active` (boolean, default true)
- `has_variants` (boolean, default false)
- `created_at`, `updated_at`

**`product_translations`** — Traduccions de productes
- `id` (UUID, PK)
- `product_id` (UUID, FK → products)
- `language` (enum: 'ca', 'es')
- `name` (text)
- `short_description` (text, nullable)
- `description` (text)
- UNIQUE(`product_id`, `language`)

**`product_images`** — Galeria d'imatges
- `id` (UUID, PK)
- `product_id` (UUID, FK → products)
- `image_url` (text) — URL a Supabase Storage
- `alt_text` (text, nullable)
- `sort_order` (int, default 0)
- `is_primary` (boolean, default false)

**`variant_types`** — Tipus de variant (Color, Talla, Mida...)
- `id` (UUID, PK)
- `slug` (text, unique)

**`variant_type_translations`**
- `id` (UUID, PK)
- `variant_type_id` (UUID, FK → variant_types)
- `language` (enum: 'ca', 'es')
- `name` (text)

**`product_variants`** — Variants concretes d'un producte
- `id` (UUID, PK)
- `product_id` (UUID, FK → products)
- `variant_type_id` (UUID, FK → variant_types)
- `value` (text) — ex: "Blau", "M", "120cm"
- `price_override` (numeric(10,2), nullable) — si null, usa base_price
- `stock_quantity` (int, default 0)
- `sku_suffix` (text, nullable)
- `is_active` (boolean, default true)

**`birth_lists`** — Llistes de naixement
- `id` (UUID, PK)
- `list_code` (text, unique) — ID públic per compartir (ex: "MUSSOLET-2024-ABC")
- `password_hash` (text) — contrasenya encriptada per accedir
- `status` (enum: 'draft', 'active', 'closed', 'archived')
- `baby_name` (text, nullable) — nom del nadó si es vol indicar
- `expected_date` (date, nullable) — data prevista
- `template_id` (UUID, FK → list_templates, nullable)
- `notes` (text, nullable) — notes internes
- `created_by` (UUID, FK → profiles, nullable) — qui l'ha creat (admin o usuari)
- `created_at`, `updated_at`

**`list_owners`** — Propietaris de la llista (1-2 per llista)
- `id` (UUID, PK)
- `list_id` (UUID, FK → birth_lists)
- `user_id` (UUID, FK → profiles, nullable) — pot estar vinculat a un compte
- `first_name` (text)
- `last_name` (text)
- `email` (text)
- `is_primary` (boolean, default false)

**`list_items`** — Productes dins d'una llista
- `id` (UUID, PK)
- `list_id` (UUID, FK → birth_lists)
- `product_id` (UUID, FK → products)
- `variant_id` (UUID, FK → product_variants, nullable)
- `quantity_desired` (int, default 1)
- `quantity_purchased` (int, default 0)
- `priority` (enum: 'high', 'medium', 'low', default 'medium')
- `sort_order` (int)
- `added_at` (timestamptz)

**`list_templates`** — Plantilles de llistes predefinides
- `id` (UUID, PK)
- `slug` (text, unique)
- `is_active` (boolean, default true)
- `created_at`

**`list_template_translations`**
- `id` (UUID, PK)
- `template_id` (UUID, FK → list_templates)
- `language` (enum: 'ca', 'es')
- `name` (text)
- `description` (text, nullable)

**`list_template_items`** — Productes d'una plantilla
- `id` (UUID, PK)
- `template_id` (UUID, FK → list_templates)
- `product_id` (UUID, FK → products)
- `variant_id` (UUID, FK → product_variants, nullable)
- `quantity` (int, default 1)
- `sort_order` (int)

**`orders`** — Comandes
- `id` (UUID, PK)
- `order_number` (text, unique) — ex: "MUS-20240101-001"
- `user_id` (UUID, FK → profiles)
- `list_id` (UUID, FK → birth_lists, nullable) — null si és compra estàndard
- `status` (enum: 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')
- `payment_method` (enum: 'stripe', 'redsys', 'bank_transfer')
- `payment_status` (enum: 'pending', 'paid', 'failed', 'refunded')
- `payment_reference` (text, nullable)
- `delivery_method` (enum: 'pickup', 'shipping_buyer', 'shipping_owners')
- `shipping_cost` (numeric(10,2), default 0)
- `subtotal` (numeric(10,2))
- `total` (numeric(10,2))
- `shipping_address` (jsonb, nullable) — {name, line1, line2, city, postal_code, province}
- `notes` (text, nullable)
- `created_at`, `updated_at`

**`order_items`** — Línies de comanda
- `id` (UUID, PK)
- `order_id` (UUID, FK → orders)
- `product_id` (UUID, FK → products)
- `variant_id` (UUID, FK → product_variants, nullable)
- `list_item_id` (UUID, FK → list_items, nullable)
- `quantity` (int)
- `unit_price` (numeric(10,2))
- `total_price` (numeric(10,2))

**`shipping_zones`** — Zones d'enviament
- `id` (UUID, PK)
- `name` (text) — ex: "Berguedà", "Catalunya", "Espanya peninsular"
- `postal_code_pattern` (text) — regex o prefix per matching
- `is_active` (boolean, default true)
- `sort_order` (int)

**`shipping_rates`** — Tarifes per zona i pes
- `id` (UUID, PK)
- `zone_id` (UUID, FK → shipping_zones)
- `min_weight_grams` (int)
- `max_weight_grams` (int)
- `price` (numeric(10,2))

**`site_settings`** — Configuració global
- `key` (text, PK) — ex: 'store_name', 'store_email', 'stripe_mode', 'free_shipping_threshold'
- `value` (text)
- `updated_at` (timestamptz)

### 2.2 Supabase Storage Buckets

| Bucket | Ús | Accés |
|--------|-----|-------|
| `product-images` | Imatges de productes | Públic (lectura) |
| `brand-logos` | Logotips de marques | Públic (lectura) |
| `site-assets` | Logo, banners, assets generals | Públic (lectura) |

### 2.3 Autenticació (Supabase Auth)
- Registre amb email + contrasenya
- Login estàndard
- Recuperació de contrasenya
- Rol assignat a `profiles.role`

### 2.4 Row Level Security (RLS) — Polítiques clau
- **Productes/Categories/Marques**: lectura pública; escriptura només admin
- **Llistes**: lectura/escriptura pel propietari i admin; lectura per invitats autenticats amb accés verificat
- **Comandes**: lectura/escriptura pel comprador i admin
- **Profiles**: lectura/escriptura pel propi usuari; lectura per admin

### 2.5 Edge Functions (Supabase)

| Funció | Descripció |
|--------|-----------|
| `verify-list-access` | Verifica ID + contrasenya de llista, retorna token d'accés temporal |
| `calculate-shipping` | Calcula despeses d'enviament segons codi postal i pes total |
| `process-stripe-payment` | Crea PaymentIntent de Stripe |
| `process-redsys-payment` | Genera formulari de pagament Redsys |
| `send-notification` | Envia correus via Resend/SMTP segons tipus d'event |
| `generate-order-number` | Genera número de comanda seqüencial |

---

## 3. Sistema d'Internacionalització (i18n)

### 3.1 Arquitectura
- **Contingut estàtic (UI):** Fitxers JSON per idioma (`ca.json`, `es.json`) amb `react-i18next`
- **Contingut dinàmic (productes, categories):** Taules `*_translations` a Supabase
- **Detecció automàtica:** Preferència de l'usuari > localStorage > idioma del navegador > català per defecte
- **Selector d'idioma:** Visible al header, persisteix a `profiles.preferred_language` si l'usuari està logat

### 3.2 Estructura de fitxers i18n
```
src/
  locales/
    ca.json    — Tots els strings de UI en català
    es.json    — Tots els strings de UI en castellà
```

### 3.3 Hooks personalitzats
- `useTranslatedProducts(products)` — Retorna productes amb nom/descripció de l'idioma actiu
- `useTranslatedCategories(categories)` — Idem per categories
- `useLanguage()` — Idioma actual + funció per canviar-lo

---

## 4. Funcionalitats — Zona Pública

### 4.1 Home / Landing Page
- Hero amb imatge/banner de marca
- Secció destacada: "Crea la teva llista de naixement"
- Productes destacats / novetats
- Categories principals amb imatges
- CTA de registre

### 4.2 Catàleg de Productes
- Llistat amb filtres: categoria, marca, preu (rang), disponibilitat
- Cerca per text (nom del producte)
- Ordenació: preu, novetats, nom
- Paginació
- Vista graella / llista
- Cada targeta mostra: imatge principal, nom, preu, marca, etiqueta d'estat (en estoc / sota comanda)

### 4.3 Fitxa de Producte
- Galeria d'imatges amb zoom/slider
- Nom, descripció completa
- Preu (o rang si té variants)
- Selector de variant (si aplica)
- Estat d'estoc
- Botó "Afegir a la cistella"
- Botó "Afegir a la meva llista" (si l'usuari té llista activa)
- Productes relacionats

### 4.4 Accés a Llista de Naixement
- Pàgina d'accés: formulari amb ID de llista + contrasenya
- Un cop verificat, es mostra la llista amb:
  - Nom de la llista / propietaris (noms, sense emails)
  - Productes de la llista amb estat: disponible / ja comprat / parcialment comprat
  - Filtre/cerca dins la llista
  - Botó "Comprar aquest regal" per cada producte disponible
- Els productes ja comprats es marquen clarament (sense revelar qui els ha comprat)

### 4.5 Cistella de Compra
- Dues modalitats:
  - **Cistella estàndard**: productes solts (botiga online)
  - **Cistella de llista**: productes d'una llista concreta
- Es poden combinar? → No, es gestionen per separat per claredat
- Resum: productes, quantitats, preus, subtotal
- Opció d'eliminar / modificar quantitats

### 4.6 Checkout
- **Pas 1:** Resum de la comanda
- **Pas 2:** Mètode de lliurament
  - Recollida a botiga
  - Enviament a la meva adreça (comprador)
  - Enviament als propietaris de la llista (només si és compra de llista)
- **Pas 3:** Càlcul de despeses d'enviament (si aplica)
- **Pas 4:** Mètode de pagament
  - Stripe (targeta)
  - Redsys (targeta)
  - Transferència bancària (instruccions + referència)
- **Pas 5:** Confirmació
- Despès del pagament: pàgina de confirmació + correu

### 4.7 Àrea d'Usuari (Dashboard)
- **El meu perfil:** Editar dades personals, adreça, idioma
- **Les meves comandes:** Historial amb estat de cada comanda
- **La meva llista:** (si en té una)
  - Veure/editar productes de la llista
  - Afegir productes des del catàleg
  - Veure quins productes ja s'han comprat (sense saber qui)
  - Compartir credencials (ID + contrasenya) — botó de copiar / enviar per WhatsApp
  - Gestionar propietaris (afegir/editar segon propietari)

### 4.8 Registre i Login
- Formulari de registre: nom, cognoms, email, contrasenya
- Login amb email + contrasenya
- Recuperació de contrasenya
- Confirmació d'email (Supabase Auth)

---

## 5. Funcionalitats — Panell d'Administració

### 5.1 Dashboard Admin
- Resum: comandes pendents, comandes del dia, productes baixos d'estoc
- Gràfic de vendes (últims 30 dies)
- Accés ràpid a seccions principals

### 5.2 Gestió de Productes (CRUD complet)
- Llistat amb cerca, filtres (categoria, marca, estat)
- Crear / editar producte:
  - Camps bàsics: SKU, preu, pes, marca, categoria
  - Traduccions: nom + descripció en CA i ES (tabs d'idioma)
  - Galeria d'imatges: pujar, reordenar, marcar principal, eliminar
  - Variants: afegir/eliminar tipus + valors, preu propi per variant
  - Estoc: gestió per producte o per variant
- Duplicar producte (per crear variants similars ràpidament)
- Activar/desactivar producte

### 5.3 Gestió de Categories (CRUD)
- Categories amb traduccions CA/ES
- Jerarquia (subcategories)
- Ordenació drag & drop o per número d'ordre

### 5.4 Gestió de Marques (CRUD)
- Nom, logo
- Activar/desactivar

### 5.5 Gestió de Llistes de Naixement
- Llistat de totes les llistes amb estat, propietaris, data
- Crear llista des d'admin (assignar propietaris)
- Editar llista:
  - Canviar estat (draft → active → closed → archived)
  - Gestionar propietaris
  - Gestionar credencials (regenerar contrasenya)
  - Veure contingut (productes de la llista)
  - **Substituir producte**: canviar un producte per un altre dins de la llista
  - Veure compres realitzades (qui ha comprat què, amb identitat)
- Assignar plantilla a una llista nova

### 5.6 Gestió de Plantilles de Llistes
- CRUD de plantilles amb traduccions CA/ES
- Definir productes de cada plantilla amb quantitats
- Previsualització

### 5.7 Gestió de Comandes
- Llistat amb filtres: estat, data, tipus (estàndard / llista), mètode de pagament
- Detall de comanda: productes, comprador, adreça, pagament, llista associada
- Canviar estat de comanda
- Marcar pagament com a rebut (per transferències bancàries)
- Notes internes

### 5.8 Gestió d'Usuaris
- Llistat d'usuaris registrats
- Veure detall: dades, comandes, llistes associades
- Canviar rol (customer / admin)

### 5.9 Configuració d'Enviaments
- CRUD de zones d'enviament
- Definir patrons de codi postal per zona
- CRUD de tarifes (per zona, rang de pes, preu)
- Previsualització/test: introduir codi postal + pes → veure tarifa

### 5.10 Configuració General
- Dades de la botiga (nom, email, telèfon, adreça)
- Configuració de pagaments (claus Stripe/Redsys, mode test/producció)
- Configuració de correus (plantilles, remitent)
- Llindar d'enviament gratuït (si aplica)

---

## 6. Sistema de Notificacions per Email

### 6.1 Events i destinataris

| Event | Destinatari | Contingut |
|-------|------------|-----------|
| Registre nou | Admin | "S'ha registrat un nou usuari: [nom]" |
| Registre nou | Usuari | "Benvingut/da a El Mussolet" |
| Compra estàndard | Admin | "Nova comanda #[num] de [nom]" |
| Compra estàndard | Comprador | "Confirmació de la teva comanda #[num]" |
| Compra de llista | Admin | "Nova compra de llista [codi]: comanda #[num]" |
| Compra de llista | Propietaris (1-2) | "Algú ha comprat un regal de la teva llista!" (SENSE revelar identitat) |
| Compra de llista | Comprador | "Confirmació de la teva compra-regal #[num]" |
| Canvi d'estat comanda | Comprador | "La teva comanda #[num] ha canviat d'estat: [estat]" |
| Transferència pendent | Comprador | "Instruccions per completar la transferència" |

### 6.2 Implementació
- Supabase Edge Functions amb servei SMTP o Resend
- Templates HTML responsives amb variables dinàmiques
- Tots els correus bilingües (s'envien en l'idioma preferit del destinatari)

---

## 7. Disseny i UX

### 7.1 Identitat Visual
- Colors corporatius d'El Mussolet (a confirmar paleta exacta)
- Tipografia neta i llegible, orientada al sector puericultura
- Tons càlids, amigables, confiança
- Logo d'El Mussolet al header

### 7.2 Layout
- **Header:** Logo + Navegació + Selector idioma + Login/Perfil + Cistella
- **Footer:** Contacte, xarxes socials, links legals, mapa del lloc
- **Mobile-first:** Tot responsive, menú hamburguesa en mòbil
- **Breadcrumbs:** En catàleg i fitxa de producte

### 7.3 Principis UX
- Màxim 3 clics per arribar a qualsevol producte
- Checkout en 5 passos clars amb indicador de progrés
- Missatges d'error i èxit clars i visibles
- Loading states en totes les operacions
- Empty states amb CTAs (ex: "La teva llista està buida. Explora el catàleg!")

---

## 8. Seguretat

- RLS a totes les taules de Supabase
- Validació d'inputs al frontend i al backend (Edge Functions)
- Contrasenya de llista hashejada (bcrypt via Edge Function)
- Rate limiting a l'accés de llistes (prevenir brute force)
- Sanitització de contingut HTML a descripcions
- HTTPS obligatori
- Variables sensibles (claus Stripe/Redsys) a Supabase Secrets

---

## 9. SEO i Rendiment

- URLs netes i semàntiques (`/producte/cotxet-trio-x`, `/categoria/cotxets`)
- Meta tags dinàmics per producte (OG tags per compartir)
- Imatges optimitzades (WebP via Supabase transformations o processament)
- Lazy loading d'imatges
- Sitemap generat dinàmicament

---

## 10. Fases d'Implementació i Prompts per Lovable

A continuació es detallen tots els prompts seqüencials per construir la plataforma a Lovable, organitzats en fases. **Cada prompt és independent i s'ha d'executar en ordre.**

---

### FASE 1: Fonaments — Base de dades, Auth i Layout

#### Prompt 1.1 — Estructura de base de dades

```
Crea una aplicació web per a una botiga de puericultura anomenada "El Mussolet" (www.elmussolet.com). Utilitza Supabase com a backend.

PRIMER, crea totes les taules a Supabase amb les següents especificacions:

1. "profiles" — extensió d'auth.users:
   - id (uuid, FK auth.users), full_name (text), phone (text nullable), address_line1 (text nullable), address_line2 (text nullable), city (text nullable), postal_code (text nullable), province (text nullable), preferred_language (text, default 'ca', check in ('ca','es')), role (text, default 'customer', check in ('customer','admin')), created_at (timestamptz), updated_at (timestamptz)

2. "categories" — id (uuid PK), slug (text unique), parent_id (uuid FK categories nullable), sort_order (int default 0), is_active (boolean default true), created_at, updated_at

3. "category_translations" — id (uuid PK), category_id (uuid FK categories ON DELETE CASCADE), language (text check in ('ca','es')), name (text), description (text nullable). UNIQUE(category_id, language)

4. "brands" — id (uuid PK), name (text), logo_url (text nullable), is_active (boolean default true)

5. "products" — id (uuid PK), sku (text unique), slug (text unique), brand_id (uuid FK brands nullable), category_id (uuid FK categories nullable), base_price (numeric(10,2)), weight_grams (int default 0), stock_quantity (int default 0), stock_status (text default 'in_stock' check in ('in_stock','on_order','out_of_stock')), is_active (boolean default true), has_variants (boolean default false), created_at, updated_at

6. "product_translations" — id (uuid PK), product_id (uuid FK products ON DELETE CASCADE), language (text check in ('ca','es')), name (text), short_description (text nullable), description (text). UNIQUE(product_id, language)

7. "product_images" — id (uuid PK), product_id (uuid FK products ON DELETE CASCADE), image_url (text), alt_text (text nullable), sort_order (int default 0), is_primary (boolean default false)

8. "variant_types" — id (uuid PK), slug (text unique)

9. "variant_type_translations" — id (uuid PK), variant_type_id (uuid FK variant_types ON DELETE CASCADE), language (text check in ('ca','es')), name (text). UNIQUE(variant_type_id, language)

10. "product_variants" — id (uuid PK), product_id (uuid FK products ON DELETE CASCADE), variant_type_id (uuid FK variant_types), value (text), price_override (numeric(10,2) nullable), stock_quantity (int default 0), sku_suffix (text nullable), is_active (boolean default true)

11. "birth_lists" — id (uuid PK), list_code (text unique), password_hash (text), status (text default 'draft' check in ('draft','active','closed','archived')), baby_name (text nullable), expected_date (date nullable), template_id (uuid FK list_templates nullable), notes (text nullable), created_by (uuid FK profiles nullable), created_at, updated_at

12. "list_owners" — id (uuid PK), list_id (uuid FK birth_lists ON DELETE CASCADE), user_id (uuid FK profiles nullable), first_name (text), last_name (text), email (text), is_primary (boolean default false)

13. "list_items" — id (uuid PK), list_id (uuid FK birth_lists ON DELETE CASCADE), product_id (uuid FK products), variant_id (uuid FK product_variants nullable), quantity_desired (int default 1), quantity_purchased (int default 0), priority (text default 'medium' check in ('high','medium','low')), sort_order (int default 0), added_at (timestamptz default now())

14. "list_templates" — id (uuid PK), slug (text unique), is_active (boolean default true), created_at

15. "list_template_translations" — id (uuid PK), template_id (uuid FK list_templates ON DELETE CASCADE), language (text check in ('ca','es')), name (text), description (text nullable). UNIQUE(template_id, language)

16. "list_template_items" — id (uuid PK), template_id (uuid FK list_templates ON DELETE CASCADE), product_id (uuid FK products), variant_id (uuid FK product_variants nullable), quantity (int default 1), sort_order (int default 0)

17. "orders" — id (uuid PK), order_number (text unique), user_id (uuid FK profiles), list_id (uuid FK birth_lists nullable), status (text default 'pending' check in ('pending','confirmed','processing','shipped','delivered','cancelled')), payment_method (text check in ('stripe','redsys','bank_transfer')), payment_status (text default 'pending' check in ('pending','paid','failed','refunded')), payment_reference (text nullable), delivery_method (text check in ('pickup','shipping_buyer','shipping_owners')), shipping_cost (numeric(10,2) default 0), subtotal (numeric(10,2)), total (numeric(10,2)), shipping_address (jsonb nullable), notes (text nullable), created_at, updated_at

18. "order_items" — id (uuid PK), order_id (uuid FK orders ON DELETE CASCADE), product_id (uuid FK products), variant_id (uuid FK product_variants nullable), list_item_id (uuid FK list_items nullable), quantity (int), unit_price (numeric(10,2)), total_price (numeric(10,2))

19. "shipping_zones" — id (uuid PK), name (text), postal_code_pattern (text), is_active (boolean default true), sort_order (int default 0)

20. "shipping_rates" — id (uuid PK), zone_id (uuid FK shipping_zones ON DELETE CASCADE), min_weight_grams (int), max_weight_grams (int), price (numeric(10,2))

21. "site_settings" — key (text PK), value (text), updated_at (timestamptz default now())

Crea Storage Buckets: "product-images" (públic), "brand-logos" (públic), "site-assets" (públic).

Habilita RLS a totes les taules. Polítiques bàsiques:
- Productes, categories, marques, variants, imatges: SELECT per tothom, INSERT/UPDATE/DELETE només si profiles.role = 'admin'
- Profiles: SELECT/UPDATE pel propi usuari (auth.uid() = id), SELECT per admin
- Orders, order_items: SELECT/INSERT pel propi usuari, tot per admin
- Birth_lists, list_owners, list_items: SELECT/UPDATE pels propietaris (via list_owners.user_id), tot per admin
- Shipping zones/rates, site_settings: SELECT per tothom, modificació per admin

Crea un trigger que creï automàticament un registre a "profiles" quan un nou usuari es registra a auth.users, amb el full_name del metadata.

Insereix dades inicials a site_settings: store_name='El Mussolet', store_email='info@elmussolet.com', default_language='ca'.
```

#### Prompt 1.2 — Layout, Routing i i18n

```
Ara configura l'aplicació amb routing, layout i internacionalització.

1. INTERNACIONALITZACIÓ amb react-i18next:
   - Crea dos fitxers de traduccions: src/locales/ca.json i src/locales/es.json
   - Configura i18next amb detecció d'idioma: primer localStorage, després navigator.language, default 'ca'
   - Inclou traduccions per a TOTA la UI: navegació, botons, formularis, missatges d'error, placeholders, labels, etc.
   - Categories de traduccions: nav (navegació), auth (login/registre), products (catàleg), cart (cistella), checkout, list (llistes), admin, common (botons genèrics, estats), footer, errors, success

2. ROUTING amb React Router:
   Rutes públiques:
   - / → Home
   - /cataleg → Catàleg de productes
   - /cataleg/:categorySlug → Categoria
   - /producte/:productSlug → Fitxa de producte
   - /llista-naixement → Pàgina d'accés a llista (formulari ID + contrasenya)
   - /llista-naixement/:listCode → Vista de llista (protegida per contrasenya)
   - /cistella → Cistella
   - /checkout → Checkout (protegida, requereix login)
   - /confirmacio/:orderId → Confirmació de comanda
   - /login → Login
   - /registre → Registre
   - /recuperar-contrasenya → Recuperar contrasenya

   Rutes protegides (requereixen login):
   - /el-meu-compte → Dashboard usuari
   - /el-meu-compte/perfil → Perfil
   - /el-meu-compte/comandes → Historial comandes
   - /el-meu-compte/la-meva-llista → Gestió de la seva llista

   Rutes admin (requereixen role='admin'):
   - /admin → Dashboard admin
   - /admin/productes → Gestió productes
   - /admin/categories → Gestió categories
   - /admin/marques → Gestió marques
   - /admin/llistes → Gestió llistes
   - /admin/plantilles → Gestió plantilles
   - /admin/comandes → Gestió comandes
   - /admin/usuaris → Gestió usuaris
   - /admin/enviaments → Gestió enviaments
   - /admin/configuracio → Configuració

3. LAYOUT:
   - Header: logo El Mussolet (placeholder), navegació principal (Catàleg, Llista de Naixement), selector d'idioma (CA/ES dropdown), botó login/nom d'usuari, icona cistella amb comptador
   - Footer: informació de contacte, links legals (Avís legal, Privacitat, Cookies), xarxes socials (icones placeholder)
   - Sidebar admin: navegació lateral amb icones per a totes les seccions admin
   - Mobile: header amb hamburger menu, navegació en drawer lateral

4. CONTEXT / STATE:
   - AuthContext: usuari actual, login, logout, isAdmin
   - LanguageContext: idioma actual, funció changeLanguage (sincronitzat amb i18next)
   - CartContext: items de cistella estàndard, items de cistella de llista, funcions add/remove/update/clear
   - ListAccessContext: llista activa (si s'ha accedit a una llista), token d'accés

Utilitza shadcn/ui per a tots els components d'UI. Colors base: to càlid amb accent en tons naturals/verds suaus (puericultura). Fes servir Tailwind CSS. Tot ha de ser responsive mobile-first.
```

---

### FASE 2: Catàleg de Productes (Zona Pública)

#### Prompt 2.1 — Pàgina de catàleg i filtres

```
Implementa la pàgina de catàleg de productes (/cataleg) amb les funcionalitats següents:

1. LLISTAT DE PRODUCTES:
   - Mostra productes actius (is_active = true) amb la traducció de l'idioma actual
   - Cada targeta de producte mostra: imatge principal (de product_images on is_primary=true), nom (traduït), preu (base_price o rang si té variants), marca, badge d'estat (en estoc/sota comanda/exhaurit)
   - Vista en graella (per defecte) i vista en llista (toggle)
   - Paginació (12 productes per pàgina)

2. FILTRES (sidebar en desktop, bottom sheet en mòbil):
   - Per categoria (amb subcategories, checkbox tree)
   - Per marca (checkbox list)
   - Per rang de preu (slider doble)
   - Per disponibilitat (en estoc / tot)
   - Botó "Esborrar filtres"

3. ORDENACIÓ:
   - Per preu (ascendent/descendent)
   - Per novetats (created_at desc)
   - Per nom (A-Z / Z-A)

4. CERCA:
   - Input de cerca a la part superior
   - Cerca per nom del producte (a product_translations del idioma actual)
   - Cerca amb debounce (300ms)

5. RUTES DE CATEGORIA:
   - /cataleg/:categorySlug mostra productes filtrats per aquella categoria
   - Breadcrumbs: Inici > Catàleg > [Categoria] > [Subcategoria]

Utilitza Supabase queries amb joins a product_translations, product_images, brands, categories, category_translations. Filtra per language = idioma actual.
Mostra loading skeleton mentre es carreguen els productes.
Mostra empty state si no hi ha resultats.
Totes les etiquetes, botons i textos en l'idioma actiu via i18next.
```

#### Prompt 2.2 — Fitxa de producte

```
Implementa la fitxa de producte (/producte/:productSlug):

1. GALERIA D'IMATGES:
   - Imatge principal gran
   - Thumbnails sota per navegar (de product_images ordenats per sort_order)
   - Navegació amb fletxes
   - Zoom on hover (en desktop)
   - Swipe en mòbil

2. INFORMACIÓ DEL PRODUCTE:
   - Nom (traduït)
   - Marca (amb link a filtre per marca)
   - Preu (o rang si té variants)
   - Descripció curta (traduïda)
   - Descripció completa (traduïda, pot contenir HTML bàsic)
   - Estat d'estoc amb badge de color (verd "En estoc", groc "Sota comanda", vermell "Exhaurit")
   - SKU

3. VARIANTS (si has_variants = true):
   - Selector per cada variant_type (ex: desplegable o botons per Color, Talla)
   - En seleccionar variant: actualitzar preu si té price_override, actualitzar disponibilitat
   - Cada variant mostra el seu estoc

4. ACCIONS:
   - Selector de quantitat (1, 2, 3...)
   - Botó "Afegir a la cistella" (afegeix al CartContext cistella estàndard)
   - Botó "Afegir a la meva llista" (visible només si l'usuari té una llista activa; afegeix a list_items)
   - Botons de compartir (copiar URL, WhatsApp)

5. PRODUCTES RELACIONATS:
   - Secció a sota amb 4 productes de la mateixa categoria

6. SEO:
   - Document title dinàmic: "[Nom producte] | El Mussolet"
   - Meta description amb short_description

Tots els textos traduïts amb i18next + taules de traducció.
```

---

### FASE 3: Autenticació i Perfil d'Usuari

#### Prompt 3.1 — Registre, Login i Perfil

```
Implementa el sistema d'autenticació complet:

1. REGISTRE (/registre):
   - Formulari: nom complet, email, contrasenya, confirmar contrasenya
   - Validació: email vàlid, contrasenya mínim 8 caràcters, contrasenyes coincideixen
   - Registre via Supabase Auth (signUp) amb metadata { full_name }
   - El trigger existent crea el perfil automàticament
   - Després del registre: redirecció a /el-meu-compte amb missatge de benvinguda
   - Tots els textos via i18next

2. LOGIN (/login):
   - Formulari: email, contrasenya
   - Link a "Has oblidat la contrasenya?"
   - Login via Supabase Auth (signInWithPassword)
   - Redirecció post-login: a la pàgina anterior o /el-meu-compte
   - Missatge d'error clar si credencials incorrectes

3. RECUPERAR CONTRASENYA (/recuperar-contrasenya):
   - Formulari amb email
   - Envia email de recuperació via Supabase Auth
   - Missatge de confirmació

4. DASHBOARD USUARI (/el-meu-compte):
   - Layout amb navegació lateral: Perfil, Les meves comandes, La meva llista
   - Pàgina principal amb resum: nombre de comandes, estat de la llista (si en té)

5. PERFIL (/el-meu-compte/perfil):
   - Formulari editable: nom, telèfon, adreça completa (línia 1, línia 2, ciutat, codi postal, província)
   - Selector d'idioma preferit (CA/ES)
   - Botó guardar amb feedback (toast de success/error)

6. HISTORIAL DE COMANDES (/el-meu-compte/comandes):
   - Llistat de comandes de l'usuari (orders on user_id = auth.uid())
   - Cada comanda mostra: número, data, total, estat (amb badge de color), tipus (estàndard/llista)
   - Click per veure detall: productes, quantitats, preus, adreça d'enviament, mètode de pagament

7. PROTECCIÓ DE RUTES:
   - Component ProtectedRoute que redirigeix a /login si no autenticat
   - Component AdminRoute que redirigeix a / si no admin

Tots els textos via i18next.
```

---

### FASE 4: Sistema de Llistes de Naixement

#### Prompt 4.1 — Creació i gestió de llista (usuari)

```
Implementa la funcionalitat de llistes de naixement per a l'usuari:

1. CREAR LLISTA (/el-meu-compte/la-meva-llista):
   - Si l'usuari no té cap llista, mostra un CTA "Crea la teva llista de naixement"
   - Formulari de creació:
     - Nom del nadó (opcional)
     - Data prevista (opcional)
     - Propietari 1 (obligatori): nom, cognoms, email (pre-emplenat amb dades de l'usuari)
     - Propietari 2 (opcional): nom, cognoms, email
     - Seleccionar plantilla (opcional): desplegable amb list_templates actives
   - Al crear:
     - Genera list_code automàtic (format: "MUS-[ANY]-[4 caràcters aleatoris]", ex: "MUS-2025-A7KP")
     - Genera contrasenya aleatòria (8 caràcters alfanumèrics)
     - Guarda password_hash (hash bcrypt) — la contrasenya en clar es mostra a l'usuari un cop
     - Si s'ha seleccionat plantilla, copia els list_template_items a list_items
     - Estat inicial: 'active'

2. GESTIONAR LLISTA (un cop creada):
   - Mostra ID de llista i contrasenya amb botons de copiar
   - Botó "Compartir per WhatsApp" (genera missatge predefinit amb ID i contrasenya)
   - Llistat de productes de la llista (list_items) amb:
     - Imatge, nom, preu, quantitat desitjada, quantitat comprada
     - Barra de progrés per cada producte (comprat/desitjat)
     - Badge de prioritat (alta/mitjana/baixa)
   - Afegir productes: botó que obre un modal amb el catàleg (cerca + selecció), permet afegir productes a la llista amb quantitat i prioritat
   - Eliminar producte de la llista
   - Editar quantitat desitjada i prioritat
   - Gestionar propietaris: editar dades del propietari 1, afegir/editar/eliminar propietari 2
   - Estadístiques de la llista: total productes, total comprats, percentatge completat

Tots els textos via i18next.
```

#### Prompt 4.2 — Accés i compra dins d'una llista

```
Implementa l'accés i compra dins d'una llista de naixement:

1. PÀGINA D'ACCÉS (/llista-naixement):
   - Explicació breu del sistema de llistes
   - Formulari: ID de llista (list_code) + contrasenya
   - Validació: crida a una Edge Function "verify-list-access" que:
     - Busca la llista per list_code
     - Compara la contrasenya amb password_hash (bcrypt compare)
     - Si vàlid, retorna les dades de la llista i un token temporal (emmagatzemat en ListAccessContext)
     - Si invàlid, retorna error
   - Rate limiting: màxim 5 intents per IP cada 15 minuts
   - Missatge d'error clar si credencials incorrectes

2. VISTA DE LLISTA (/llista-naixement/:listCode):
   - Requereix verificació prèvia (ListAccessContext ha de tenir token vàlid)
   - Header de la llista: noms dels propietaris, nom del nadó (si indicat), data prevista
   - Llistat de productes de la llista:
     - Productes disponibles (quantity_purchased < quantity_desired): amb botó "Comprar aquest regal"
     - Productes completats (quantity_purchased >= quantity_desired): marcats amb check, sense botó de compra
     - Cada producte mostra: imatge, nom, preu, quantitat restant per comprar
   - Filtre: disponibles / tots
   - Cerca dins de la llista

3. COMPRA DE REGAL:
   - Al clicar "Comprar aquest regal":
     - Si no autenticat: redirigir a login/registre amb return URL
     - Si autenticat: afegir producte a la cistella de llista (CartContext, mode llista)
     - Permetre seleccionar quantitat (fins al màxim disponible)
   - La cistella de llista es manté separada de la cistella estàndard
   - Al checkout de llista: opció addicional de lliurament "Enviament als propietaris de la llista"

4. POST-COMPRA:
   - Actualitzar list_items.quantity_purchased
   - Disparar notificacions (email als propietaris SENSE revelar identitat del comprador)

Crea la Supabase Edge Function "verify-list-access" amb bcrypt per verificar contrasenya.
Tots els textos via i18next.
```

---

### FASE 5: Cistella i Checkout

#### Prompt 5.1 — Cistella de compra

```
Implementa la cistella de compra (/cistella):

1. CART CONTEXT (ja creat, ara implementa la UI):
   - Dues cistelles separades internament: estàndard i de llista
   - Persistent en localStorage (però sense dades sensibles)

2. PÀGINA DE CISTELLA:
   - Si la cistella està buida: empty state amb CTA "Explora el catàleg"
   - Tabs o seccions si hi ha items en ambdues cistelles
   - Per cada item:
     - Imatge thumbnail
     - Nom del producte (traduït)
     - Variant seleccionada (si aplica)
     - Preu unitari
     - Selector de quantitat (amb validació d'estoc)
     - Preu total de la línia
     - Botó eliminar
   - Si és cistella de llista: indicar a quina llista pertany
   - Resum:
     - Subtotal
     - Text "Despeses d'enviament es calcularan al checkout"
     - Total estimat
   - Botó "Continuar comprant" → torna al catàleg
   - Botó "Tramitar comanda" → va a /checkout (requereix login)

3. ICONA DE CISTELLA AL HEADER:
   - Mostra nombre total d'articles
   - Mini dropdown al fer hover/click amb resum dels items i botó anar a cistella

Tots els textos via i18next.
```

#### Prompt 5.2 — Checkout i pagament

```
Implementa el procés de checkout (/checkout):

1. CHECKOUT EN PASSOS (stepper visual):

   PAS 1 — RESUM:
   - Llista de productes amb quantitats i preus
   - Subtotal

   PAS 2 — LLIURAMENT:
   - 3 opcions (radio buttons):
     a) Recollida a botiga (gratuït)
     b) Enviament a la meva adreça
     c) Enviament als propietaris de la llista (només visible si és compra de llista)
   - Si opció b: formulari d'adreça (pre-emplenat amb dades del perfil) o opció d'usar adreça guardada
   - Si opció c: mostra l'adreça dels propietaris (si disponible) o demana-la
   - Càlcul automàtic de despeses d'enviament:
     - Crida a Edge Function "calculate-shipping" amb codi postal + pes total
     - Matching de codi postal amb shipping_zones.postal_code_pattern
     - Busca tarifa a shipping_rates per zona + rang de pes
     - Mostra cost d'enviament

   PAS 3 — PAGAMENT:
   - Opcions (radio buttons):
     a) Targeta (Stripe): integració Stripe Elements (CardElement)
     b) Targeta (Redsys): redirecció a passarel·la Redsys
     c) Transferència bancària: mostra instruccions (IBAN, concepte amb número de comanda)
   - Acceptació de termes i condicions (checkbox obligatori)

   PAS 4 — CONFIRMACIÓ:
   - Resum final complet: productes, lliurament, cost enviament, mètode pagament, total
   - Botó "Confirmar i pagar"
   - En confirmar:
     - Crea registre a orders amb order_number generat (Edge Function)
     - Crea registres a order_items
     - Si pagament Stripe: crea PaymentIntent, processa pagament
     - Si pagament Redsys: redirigeix a passarel·la
     - Si transferència: status='pending', payment_status='pending'
     - Si és compra de llista: actualitza list_items.quantity_purchased
     - Dispara notificacions email
     - Buida la cistella corresponent
     - Redirigeix a /confirmacio/:orderId

2. PÀGINA DE CONFIRMACIÓ (/confirmacio/:orderId):
   - Missatge d'èxit
   - Resum de la comanda
   - Número de comanda
   - Si transferència: instruccions de pagament destacades
   - Botó "Tornar a la botiga"

Crea les Edge Functions necessàries:
- "calculate-shipping": rep postal_code i total_weight_grams, retorna shipping_cost
- "generate-order-number": genera MUS-[YYYYMMDD]-[SEQ] atòmic
- "process-stripe-payment": crea Stripe PaymentIntent

Tots els textos via i18next.
```

---

### FASE 6: Panell d'Administració

#### Prompt 6.1 — Dashboard i gestió de productes (admin)

```
Implementa el panell d'administració protegit per rol admin:

1. LAYOUT ADMIN (/admin):
   - Sidebar lateral amb navegació: Dashboard, Productes, Categories, Marques, Llistes, Plantilles, Comandes, Usuaris, Enviaments, Configuració
   - Header amb nom admin i botó logout
   - Mobile: sidebar en drawer

2. DASHBOARD (/admin):
   - Targetes de resum: comandes pendents (count), comandes d'avui (count), productes baixos d'estoc (<5 unitats, count), ingressos del mes (sum)
   - Gràfic de vendes últims 30 dies (recharts, LineChart amb total per dia)
   - Últimes 5 comandes (taula amb link a detall)
   - Productes amb estoc crític (taula)

3. GESTIÓ DE PRODUCTES (/admin/productes):
   - Taula amb columnes: imatge, nom (CA), SKU, preu, estoc, estat, marca, accions
   - Filtres: cerca per nom/SKU, filtre per categoria, marca, estat
   - Paginació
   - Botó "Nou producte"

4. CREAR/EDITAR PRODUCTE (/admin/productes/nou, /admin/productes/:id):
   - TABS d'idioma (CA | ES) per als camps traduïbles
   - Formulari amb seccions:
     a) Informació bàsica: SKU, slug (auto-generat des del nom), marca (select), categoria (select), preu base, pes, estat d'estoc
     b) Traduccions (per cada idioma tab): nom, descripció curta, descripció completa (textarea o rich text bàsic)
     c) Imatges: zona de drag & drop per pujar imatges a Supabase Storage "product-images", reordenar amb drag & drop, marcar imatge principal, eliminar
     d) Variants (si has_variants = true):
        - Toggle "Producte amb variants"
        - Seleccionar variant_type (o crear-ne un de nou)
        - Afegir valors de variant amb preu propi (opcional) i estoc
        - Taula de variants existents amb edició inline
   - Botó guardar (crea/actualitza product + product_translations + product_images + product_variants)
   - Botó "Duplicar producte" (crea còpia amb nou SKU)
   - Toggle activar/desactivar

Tots els textos d'admin també via i18next.
```

#### Prompt 6.2 — Gestió de categories, marques i plantilles (admin)

```
Implementa les seccions d'administració de categories, marques i plantilles:

1. CATEGORIES (/admin/categories):
   - Llistat en arbre (mostra jerarquia pare/fill)
   - Per cada categoria: nom (CA+ES), slug, estat, ordre
   - Crear/editar categoria: nom en CA i ES (tabs idioma), slug (auto-generat), categoria pare (select), ordre, activa/inactiva
   - Drag & drop per reordenar (actualitza sort_order)
   - Eliminar categoria (amb confirmació, només si no té productes associats)

2. MARQUES (/admin/marques):
   - Taula: logo (thumbnail), nom, estat, accions
   - Crear/editar marca: nom, pujar logo a Supabase Storage "brand-logos", activa/inactiva
   - Eliminar marca (amb confirmació, només si no té productes associats)

3. PLANTILLES DE LLISTES (/admin/plantilles):
   - Taula: nom (CA), descripció, nombre de productes, estat
   - Crear/editar plantilla:
     - Nom i descripció en CA i ES (tabs idioma)
     - Slug (auto-generat)
     - Productes de la plantilla:
       - Buscador de productes (autocomplete) per afegir
       - Taula de productes inclosos amb: imatge, nom, quantitat, variant (si aplica), ordre
       - Reordenar amb drag & drop
       - Eliminar producte de la plantilla
     - Previsualització: com es veurà la llista generada
   - Activar/desactivar plantilla

Tots els textos via i18next.
```

#### Prompt 6.3 — Gestió de llistes i comandes (admin)

```
Implementa la gestió de llistes i comandes des d'admin:

1. LLISTES (/admin/llistes):
   - Taula: codi de llista, propietaris, nom nadó, estat, data creació, productes/comprats
   - Filtres: estat, cerca per codi/nom propietari
   - Crear llista des d'admin:
     - Formulari: nom nadó, data prevista, propietari 1 (nom, cognoms, email), propietari 2 (opcional)
     - Seleccionar plantilla (opcional)
     - Genera list_code i contrasenya automàticament

2. DETALL/EDITAR LLISTA (/admin/llistes/:id):
   - Informació general: codi, contrasenya (mostrar/ocultar), estat, dates
   - Canviar estat (select amb transicions vàlides)
   - Regenerar contrasenya (amb confirmació)
   - Gestionar propietaris: editar dades, afegir/eliminar propietari 2
   - Productes de la llista:
     - Taula: imatge, nom, quantitat desitjada, quantitat comprada, prioritat, accions
     - Afegir producte (buscador)
     - SUBSTITUIR PRODUCTE: botó que obre modal per seleccionar producte substitut del catàleg, manté la quantitat desitjada i comprada
     - Eliminar producte
   - Historial de compres: taula amb comprador, producte, data, comanda
   - Notes internes (textarea)

3. COMANDES (/admin/comandes):
   - Taula: número, data, client, total, estat comanda, estat pagament, tipus (estàndard/llista), accions
   - Filtres: estat, mètode pagament, data (rang), tipus, cerca per número/client
   - Paginació

4. DETALL COMANDA (/admin/comandes/:id):
   - Informació del client (nom, email, telèfon)
   - Llista associada (si aplica, amb link)
   - Productes: taula amb imatge, nom, variant, quantitat, preu unitari, total
   - Adreces: adreça d'enviament
   - Pagament: mètode, estat, referència
   - Accions:
     - Canviar estat de comanda (select)
     - Marcar com a pagat (per transferències: botó "Confirmar recepció pagament")
     - Notes internes

Tots els textos via i18next.
```

#### Prompt 6.4 — Gestió d'usuaris, enviaments i configuració (admin)

```
Implementa les seccions restants d'administració:

1. USUARIS (/admin/usuaris):
   - Taula: nom, email, rol, data registre, comandes, llista
   - Cerca per nom/email
   - Detall d'usuari: dades del perfil, comandes associades, llista (si en té)
   - Canviar rol: customer ↔ admin (amb confirmació)

2. ENVIAMENTS (/admin/enviaments):
   - ZONES:
     - Taula: nom, patró codi postal, estat, accions
     - Crear/editar zona: nom, patró de codi postal (regex o prefix, ex: "08___" per Barcelona, "08___,17___,25___,43___" per Catalunya), activa/inactiva
     - Exemple de zones predefinides que es podrien crear:
       * Berguedà (086__)
       * Resta Catalunya
       * Espanya peninsular
       * Balears
   - TARIFES:
     - Per cada zona: taula de tarifes per rang de pes
     - Crear/editar tarifa: pes mínim (g), pes màxim (g), preu
     - Validació: els rangs no es poden solapar
   - CALCULADORA DE TEST:
     - Formulari: codi postal + pes (g)
     - Mostra: zona detectada + tarifa aplicable
     - Útil per verificar la configuració

3. CONFIGURACIÓ (/admin/configuracio):
   - Formulari organitzat en seccions:
     a) Dades de la botiga: nom, email, telèfon, adreça
     b) Pagaments:
        - Stripe: mode (test/producció), clau pública, clau secreta (masked)
        - Redsys: merchant code, terminal, clau secreta (masked), mode test/producció
        - Transferència: activar/desactivar, IBAN, titular, banc
     c) Correus: email remitent, nom remitent
     d) Enviament gratuït: llindar d'import per enviament gratuït (0 = desactivat)
   - Guardar configuració (actualitza site_settings)

Tots els textos via i18next.
```

---

### FASE 7: Notificacions Email

#### Prompt 7.1 — Sistema de notificacions

```
Implementa el sistema de notificacions per email:

1. EDGE FUNCTION "send-notification":
   - Rep: type (tipus d'event), data (dades específiques de l'event)
   - Utilitza Resend API (o SMTP) per enviar correus
   - Templates HTML responsives amb variables

2. TIPUS DE NOTIFICACIONS:

   a) "user_registered":
      - A admin: "Nou registre: [nom] ([email])"
      - A usuari: "Benvingut/da a El Mussolet" amb link al perfil

   b) "order_standard":
      - A admin: "Nova comanda #[num] — [total]€ — [nom client]"
      - A comprador: "Confirmació de la teva comanda #[num]" amb detall productes, total, mètode lliurament, mètode pagament
      - Si transferència: incloure instruccions de pagament

   c) "order_list":
      - A admin: "Nova compra de llista [codi] — Comanda #[num]"
      - A propietaris (1 o 2): "Bones notícies! Algú ha comprat un regal de la teva llista 🎁" — sense dir QUI ni QUÈ ha comprat (efecte sorpresa)
      - A comprador: "Confirmació de la teva compra-regal #[num]"

   d) "order_status_changed":
      - A comprador: "La teva comanda #[num] ha canviat d'estat: [nou_estat]"

   e) "payment_confirmed":
      - A comprador: "Hem rebut el pagament de la comanda #[num]"

3. TEMPLATES:
   - Cada template té versió CA i ES
   - S'envia en l'idioma preferit del destinatari (profiles.preferred_language)
   - Per propietaris de llista: usar l'idioma del propietari (si disponible) o 'ca' per defecte
   - Disseny: logo El Mussolet, colors de marca, footer amb dades de contacte

4. TRIGGERS:
   - Integrar les crides a "send-notification" en els fluxos existents:
     - Registre: cridar després de crear perfil
     - Compra: cridar després de crear comanda
     - Canvi d'estat: cridar des de l'admin quan es canvia l'estat

Crea la Edge Function "send-notification" amb tots els templates HTML.
```

---

### FASE 8: Home Page i Poliment Final

#### Prompt 8.1 — Home page i SEO

```
Implementa la pàgina d'inici i poliment final:

1. HOME PAGE (/):
   - HERO: secció amb imatge de fons (placeholder), títol "El Mussolet — La teva botiga de puericultura", subtítol, botó CTA "Explora el catàleg"
   - SECCIÓ LLISTES: "Crea la teva llista de naixement" amb explicació breu i botons: "Crear llista" (si logat) / "Registra't" (si no) i "Accedir a una llista"
   - PRODUCTES DESTACATS: grid de 4-8 productes (els més recents o destacats)
   - CATEGORIES: grid amb imatges placeholder de les categories principals
   - CONFIANÇA: icones amb "Enviament segur", "Recollida a botiga", "Atenció personalitzada"

2. SEO:
   - React Helmet per meta tags dinàmics
   - Cada pàgina de producte: title, description, og:image amb imatge principal
   - Cada categoria: title amb nom de categoria
   - URLs netes i descriptives (slugs en català)
   - Sitemap bàsic (ruta /sitemap.xml generada per Edge Function)

3. POLIMENT GENERAL:
   - Loading states amb skeletons a totes les pàgines
   - Empty states amb CTAs a totes les llistes buides
   - Toast notifications per accions (afegir a cistella, guardar perfil, errors)
   - 404 page personalitzada
   - Scroll to top en navegació
   - Breadcrumbs consistents
   - Favicon i manifest.json amb dades d'El Mussolet
   - Revisar que TOTS els textos estàtics estan via i18next en CA i ES
   - Responsive final: verificar totes les pàgines en mobile/tablet/desktop

4. ACCESSIBILITAT:
   - Alt text a totes les imatges
   - Labels a tots els inputs
   - Focus states visibles
   - Contrast adequat
   - Navegació per teclat funcional
```

---

## 11. Consideracions Addicionals

### 11.1 Millores recomanades (futures iteracions)
- **Wishlist/favorits**: Guardar productes preferits
- **Ressenyes de productes**: Valoracions i comentaris
- **Analytics**: Integració Google Analytics 4
- **Exportació**: Exportar llistes/comandes a PDF/Excel des d'admin
- **Multi-moneda**: Si s'expandeix a mercat internacional
- **Progressive Web App (PWA)**: Per experiència nativa en mòbil
- **Notificacions push**: Avisos en temps real
- **Gestió de cupons/descomptes**: Sistema de promocions
- **Blog/contingut**: Secció de consells per a pares/mares

### 11.2 Requisits legals (a implementar)
- Política de privacitat (RGPD)
- Avís legal
- Política de cookies (banner de consentiment)
- Condicions generals de compra
- Dret de desistiment
