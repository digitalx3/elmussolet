# Pla — Lot 4

Quatre blocs independents. Els implemento en una sola tongada si ho confirmes.

---

## 1) Servidor SMTP propi (admin + enviament real)

**Backend**
- Nova taula `smtp_settings` (única fila): `host`, `port`, `username`, `from_email`, `from_name`, `security` (`none|ssl|tls|starttls`), `password_encrypted`, `is_active`.
- RLS: només admins poden llegir/escriure.
- La contrasenya s'escriu des de l'admin però **no es retorna mai** al client (columna marcada i la query d'admin omet `password_encrypted`; un endpoint dedicat la desa via service role).

**Edge Function** `send-smtp-email`
- Llegeix la fila activa de `smtp_settings` amb service role.
- Envia via `denomailer` (SMTP/STARTTLS/SSL natiu Deno, sense dependències npm).
- Reemplaça l'ús actual de Resend a `send-contact-email` i `send-order-status-email` per aquest nou enviament unificat.

**Admin UI** — nova pestanya "Correu / SMTP" a Configuració:
- Camps: Servidor, Port, Usuari, Contrasenya (write-only), Seguretat (select), Email remitent, Nom remitent, Actiu.
- Botó "Provar enviament" que invoca la funció amb un destinatari de prova.

> Nota: la contrasenya viatja per HTTPS al desar, queda emmagatzemada xifrada en repòs per Postgres però llegible per la funció. És la forma habitual per a SMTP gestionable des d'UI.

---

## 2) Editor HTML per pàgines legals (AdminPages)

- Al `RichTextEditor` afegir botó toggle **"</> Codi font"** que canvia entre vista WYSIWYG i `<textarea>` amb el HTML cru.
- En desar des de vista codi, es guarda tal com està (permet enganxar HTML existent de pàgines actuals).
- Sanititzat al render públic amb una whitelist permissiva (`DOMPurify` ja disponible al projecte, o el sanititzador actual si n'hi ha).

---

## 3) Tipografia headings que no s'aplica

**Diagnòstic ràpid (a fer abans):** comprovar `AppearanceInjector.tsx` per veure si injecta variables CSS de `font_heading` i si `index.css`/`tailwind.config.ts` les fan servir a `h1..h6`.

**Fix esperat**
- Garantir que la font de heading es carrega via Google Fonts loader.
- Afegir CSS global:
  ```css
  h1,h2,h3,h4,h5,h6,.font-display { font-family: var(--font-heading, var(--font-display, serif)); }
  body { font-family: var(--font-body, system-ui, sans-serif); }
  ```
- Assegurar que els `<h1>`/`<h2>` del frontend no porten `font-display` hardcoded que els bloquegi.

---

## 4) Ubicació de les pàgines CMS al frontend

- Afegir camps a la taula `pages` (o `cms_pages`): `menu_location` (`none|header|footer`), `menu_order` (int), `is_published` (bool).
- Al formulari d'admin de pàgines: selector "Ubicació al menú" (Cap / Menú superior / Peu de pàgina) + ordre.
- `Header.tsx` carrega pàgines amb `menu_location='header'` i les pinta com a enllaços `/p/{slug}`.
- `Footer.tsx` afegeix una columna "Informació" amb pàgines `menu_location='footer'`.
- Ruta pública `/p/:slug` ja existeix (`CmsPagePage`); si no, la creo.

---

## Ordre d'execució suggerit
1. Pàgines CMS al menú (ràpid, alt impacte visual).
2. Fix tipografia headings.
3. Vista HTML a l'editor.
4. SMTP propi (més feina; necessita migració + edge function + UI).

Confirma-ho i ho faig **tot seguit**. Si vols saltar-te algun bloc, indica-m'ho.