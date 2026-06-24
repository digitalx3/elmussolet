# Mode manteniment

Nova secció a Administració per posar la web en manteniment, amb logo + missatge personalitzat i llista d'IPs autoritzades. Els administradors autenticats sempre poden entrar; els visitants només si la seva IP està a la llista o accedeixen per la URL privada d'admin.

## 1. Base de dades

Nova taula `maintenance_settings` (singleton, 1 fila):

- `id` (uuid, PK, default fix)
- `enabled` (bool, default false)
- `message_ca` (text) i `message_es` (text) — HTML del missatge (editor ric)
- `show_logo` (bool, default true)
- `allowed_ips` (text[], default `{}`) — llista d'IPs/CIDR que poden saltar-se el manteniment
- `updated_at`, `updated_by`

RLS:
- `SELECT` públic (anon + authenticated) — cal per saber si la web està en manteniment
- `UPDATE` només admin (via `is_admin(auth.uid())`)

GRANTs estàndard a `anon`, `authenticated`, `service_role`.

## 2. Edge function `check-maintenance-access`

Retorna `{ in_maintenance: boolean, bypass: boolean, settings: {...} }`:
- Llegeix `maintenance_settings`
- Obté IP del client via `x-forwarded-for`
- `bypass = true` si IP coincideix amb `allowed_ips` (suport CIDR bàsic IPv4)
- Públic (verify_jwt=false)

## 3. Frontend — guard global

Nou `MaintenanceGate` muntat a `App.tsx` que embolcalla les rutes públiques:

1. Crida `check-maintenance-access` un cop al carregar
2. Si `in_maintenance && !bypass`:
   - Si l'usuari està autenticat **i** és admin → deixa passar
   - Si la ruta comença per `/admin` o `/login-admin` → deixa passar (l'admin pot entrar amb les seves credencials)
   - En qualsevol altre cas → renderitza `<MaintenancePage />`
3. Es revalida en focus de finestra

`MaintenancePage`:
- Fons net amb el logo del site (`useSiteSettings`) centrat
- Missatge HTML segons idioma (`i18n.language`) amb `dangerouslySetInnerHTML` (ja sanititzat per l'editor)
- Sense header/footer

URL "privada" d'admin: `/login` continua funcionant sempre (ja és la pàgina de login). Els administradors entren, AuthContext detecta rol admin, i el gate els deixa passar a qualsevol ruta.

## 4. Admin UI — `AdminMaintenance.tsx`

Nova pàgina a `Configuració → Manteniment`:

- Switch **Activar mode manteniment** (vermell quan està actiu, amb avís)
- Switch **Mostrar logo**
- `RichTextEditor` per missatge en català
- `RichTextEditor` per missatge en castellà
- Editor d'IPs autoritzades:
  - Llista d'inputs amb botó "Afegir IP" / "Eliminar"
  - Botó "Afegir la meva IP actual" (detecta via `https://api.ipify.org`)
  - Validació format IPv4 / CIDR
- Botó **Desar canvis**
- Caixa informativa: "Els administradors autenticats sempre poden accedir des de `/login`."

## 5. Ruta i sidebar

- Afegir ruta `/admin/maintenance` a `AdminDashboard.tsx`
- Afegir entrada al grup **Configuració** de `AdminLayout.tsx` (icona `Wrench` o `Power`)
- Traduccions `admin.nav.maintenance` a `ca.json` / `es.json`

## 6. Detalls tècnics

- L'estat del gate es cachea a `sessionStorage` 60s per evitar flicker entre navegacions
- Si la edge function falla → fallback: deixa passar (fail-open) per no bloquejar la web mai per un error de backend
- El missatge s'edita amb el `RichTextEditor` existent (visual + HTML)

## Fitxers afectats

- Migració SQL nova (taula + RLS + GRANTs)
- `supabase/functions/check-maintenance-access/index.ts` (nou)
- `src/components/MaintenanceGate.tsx` (nou)
- `src/pages/MaintenancePage.tsx` (nou)
- `src/pages/admin/AdminMaintenance.tsx` (nou)
- `src/App.tsx` (muntar gate)
- `src/pages/AdminDashboard.tsx` (ruta)
- `src/components/admin/AdminLayout.tsx` (sidebar)
- `src/locales/ca.json`, `src/locales/es.json`
