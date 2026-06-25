
# Módulo de gestión de cookies

Implementación completa, compatible con normativa española y europea, sin romper funcionalidades actuales. El proyecto hoy no tiene Google Analytics ni scripts de marketing; Google Maps se usa vía `iframe` en `ContactPage`. Aprovecho esto para hacer una implementación limpia.

## 1. Base de datos (migración Supabase)

Crear las siguientes tablas en `public` con GRANTs + RLS:

- **`cookie_categories`** — `key` (`necessary|functional|analytics|marketing|third_party`), `is_required` bool, `is_enabled` bool, `sort_order`, traducciones (`name_ca/es`, `description_ca/es`). Seed inicial con las 5 categorías; `necessary` marcada como `is_required = true` y no desactivable.
- **`cookies_registry`** — `name`, `provider`, `category_id`, `purpose_ca/es`, `duration`, `type` (`first_party|third_party`), `requires_consent` bool, `service` (free text: ga, maps, session, cart…), `sort_order`.
- **`cookie_consent_log`** — registro auditable: `id`, `anon_id` (uuid del visitante, guardado en localStorage), `user_id` nullable, `consent` jsonb (por categoría), `policy_version`, `user_agent`, `ip_hash`, `created_at`. Append-only.
- **`cookie_settings`** (singleton) — `policy_version` int, `ga_measurement_id` text nullable, `ga_enabled` bool, `maps_requires_consent` bool, `banner_text_ca/es`, `banner_text_short_ca/es`.

RLS: lectura pública (`anon` + `authenticated`) en `cookie_categories`, `cookies_registry`, `cookie_settings`. Escritura solo admins (`is_admin(auth.uid())`). `cookie_consent_log`: insert público (anon+auth), select solo admin.

Seed de cookies actuales detectadas: `sb-*-auth-token` (necessary, Supabase), `cart` localStorage (necessary), `lang` preferencia (functional), `cookie_consent` (necessary).

## 2. Backend / lógica de consentimiento

- `src/lib/cookieConsent.ts`: API central
  - `getConsent()` → lee `localStorage.cookie_consent` (`{ version, categories: {necessary:true, functional:bool, analytics:bool, marketing:bool, third_party:bool}, ts }`)
  - `setConsent(categories)`: guarda local + `POST` a Supabase `cookie_consent_log` (vía `supabase-js`, sin edge function), genera `anon_id` persistente.
  - `hasConsent(category)`, `revoke()`, `acceptAll()`, `rejectAll()`, listener `onConsentChange(cb)` (eventBus simple).
  - Borra cookies de categorías rechazadas vía `document.cookie = name + '=; expires=...'` (best-effort para 1st-party).
- `CookieConsentProvider` en `src/contexts/CookieConsentContext.tsx`, montado en `App.tsx` (antes de `MaintenanceGate`).

## 3. UI usuario

- `CookieBanner.tsx` — banner inferior responsive con 3 botones de igual peso visual: **Aceptar todo / Rechazar todo / Configurar**. Aparece solo si no hay consentimiento o si `policy_version` cambió.
- `CookiePreferencesDialog.tsx` — modal con accordion por categoría, switches (necessary bloqueado), tabla desplegable con cookies registradas (lectura de `cookies_registry`). Botones: Guardar selección / Aceptar todo / Rechazar opcionales.
- Enlace permanente en `Footer.tsx`: "Configurar cookies" que abre el dialog (vía contexto).
- Estética coherente con tokens existentes (sage/terracotta/sand, Playfair/DM Sans).

## 4. Bloqueo real de scripts

- `GoogleAnalyticsLoader.tsx` (montado en App): si `ga_enabled && ga_measurement_id && hasConsent('analytics')`, inyecta `gtag.js` dinámicamente. Si se retira el consentimiento → `window['ga-disable-<ID>'] = true` y se eliminan cookies `_ga*`.
- `ContactPage.tsx` — sustituir iframe directo de Google Maps por componente `ConsentedMap`:
  - Si `maps_requires_consent && !hasConsent('third_party')` → placeholder con explicación + botón "Configurar cookies".
  - Si hay consentimiento → renderiza el iframe.
- Reaccionan a `onConsentChange` para cargar/descargar al vuelo.

## 5. Administración

Nuevas rutas en `AdminDashboard.tsx`, grupo Configuración:

- `/admin/cookies` → `AdminCookieSettings.tsx`: ajustes globales (versión política, GA ID + toggle, Maps requiere consentimiento, textos del banner CA/ES con `LanguageTabs`).
- `/admin/cookies/categories` → `AdminCookieCategories.tsx`: CRUD categorías, activar/desactivar opcionales, traducciones.
- `/admin/cookies/registry` → `AdminCookieRegistry.tsx`: CRUD cookies (todos los campos del requisito), filtro/agrupación por categoría.
- `/admin/cookies/consent-log` → `AdminCookieConsentLog.tsx`: visor de auditoría (fecha, anon_id, user, categorías aceptadas, versión).

Añadir entradas en `AdminLayout.tsx` bajo el grupo Configuración: "Cookies", "Categories cookies", "Registre cookies", "Historial consentiments".

## 6. Política de cookies

- Página pública `/politica-cookies` (`CookiePolicyPage.tsx`): renderiza dinámicamente desde `cookie_categories` + `cookies_registry` agrupadas por categoría, en el idioma activo. Incluye botón "Canviar preferències" que abre el dialog. Bumping de `policy_version` invalida consentimientos previos y reaparece el banner.
- Si existe la página CMS actual de "Política de cookies", se reemplaza el contenido con un placeholder que enlaza a la nueva ruta dinámica (o se renderiza embebida).

## 7. i18n

Añadir claves nuevas a `src/locales/ca.json` y `es.json` bajo `cookies.*` (banner, dialog, categorías por defecto, política, placeholders).

## 8. Verificación

1. Primera visita → aparece banner; no se carga GA ni Maps.
2. Aceptar todo → GA carga, Maps renderiza, log insertado.
3. Rechazar opcionales → ningún script opcional carga; Maps muestra placeholder; cart/login siguen funcionando.
4. Configurar por categorías y guardar → solo cargan las aceptadas.
5. Cambiar preferencias desde footer/política → estado se actualiza en caliente sin recargar.
6. Bump de `policy_version` en admin → banner reaparece a todos.
7. Admin puede CRUD cookies, categorías, ajustes; ver historial.
8. Tests responsive móvil/tablet/desktop del banner y dialog.

## Archivos afectados / nuevos

**Nuevos**: `src/lib/cookieConsent.ts`, `src/contexts/CookieConsentContext.tsx`, `src/components/cookies/{CookieBanner,CookiePreferencesDialog,ConsentedMap,GoogleAnalyticsLoader}.tsx`, `src/pages/CookiePolicyPage.tsx`, `src/pages/admin/{AdminCookieSettings,AdminCookieCategories,AdminCookieRegistry,AdminCookieConsentLog}.tsx`, migración Supabase.

**Editados**: `src/App.tsx` (providers + ruta política), `src/components/layout/Footer.tsx` (link configurar), `src/pages/ContactPage.tsx` (ConsentedMap), `src/pages/AdminDashboard.tsx` (rutas), `src/components/admin/AdminLayout.tsx` (menú), `src/locales/ca.json` + `es.json`.

No se modifica `index.html`, `client.ts`, `types.ts` ni configuración Supabase global.
