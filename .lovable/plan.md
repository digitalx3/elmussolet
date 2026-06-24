# Pla: Reorganització de menú + sistema d'idiomes

## 1. Moure "Servidor SMTP" a Configuració

A `src/components/admin/AdminLayout.tsx`:
- Treure l'ítem `smtp` del grup `communication`.
- Afegir-lo al grup `config` (just abans de `settings`).
- Si el grup `communication` queda només amb `messages`, mantenir-lo igualment (té sentit semàntic).

## 2. Sistema d'idiomes dinàmics (BD)

### Esquema nou

**`languages`** — idiomes que existeixen al sistema
- `code` (PK, text, ex: `ca`, `es`, `en`)
- `name` (text, ex: "Català")
- `native_name` (text, ex: "Català")
- `is_enabled` (bool) — visible al frontend
- `is_default` (bool) — un sol idioma per defecte
- `sort_order` (int)

GRANTs: `SELECT` a `anon`+`authenticated` (cal a tot arreu); escriptura només admin via RLS amb `is_admin()`.

Sembrar amb `ca` (default, enabled) i `es` (enabled).

### UI admin — nova pàgina

`/admin/idiomes` dins el grup **Configuració**:
- Llistar idiomes, activar/desactivar, marcar per defecte, afegir-ne (codi ISO + nom).
- Eliminar només si no és el default i no té contingut traduït referenciat.

### Frontend — càrrega dinàmica

- Nou hook `useLanguages()` que llegeix `languages` actius (cache via React Query).
- `src/i18n.ts`: després de detectar idiomes, validar contra la llista activa; fallback al default de la BD.
- Selector d'idioma a `Header` (públic) i a `AdminLayout` header (admin), poblat des de `useLanguages()`.

## 3. Traduccions UI (JSON al codi)

- Auditar `src/locales/ca.json` i `es.json`: ja existeix una clau `admin` però **les pàgines admin no usen `useTranslation` consistentment**. Hi ha labels durs (`'General'`, `'Catàleg'`, `'Aparença'`, etc.) a `AdminLayout` i moltes pàgines.
- Extreure tots els textos hardcodejats de:
  - `AdminLayout` (labels de grups + items que no tenen `label` traduït)
  - Totes les pàgines `src/pages/admin/*.tsx` (títols, botons, missatges toast, columnes de taula)
  - Components admin compartits
- Ampliar `ca.json` i `es.json` amb namespaces: `admin.nav.*`, `admin.groups.*`, `admin.pages.<page>.*`, `admin.actions.*`, `admin.toasts.*`.
- Quan s'afegeix un idioma nou a la BD però encara no hi ha fitxer JSON: fallback automàtic al default (i18next ho fa per defecte amb `fallbackLng`).
- Documentar al README com afegir un fitxer `locales/<code>.json` quan s'habilita un idioma nou.

## 4. Traduccions de contingut (BD)

Patró existent: taules `<entity>_translations` amb `(entity_id, language_code, ...)`. Replicar-ho a:

### Noves taules de traducció

- **`brand_translations`**: `brand_id`, `language_code`, `name`, `description`
- **`list_section_translations`**: `section_id`, `language_code`, `title`
- **`cms_block_translations`**: `block_id`, `language_code`, `title`, `subtitle`, `body`, `cta_label`  
  (Avui `cms_blocks` té camps `*_ca`/`*_es` durs — migrar-los a la nova taula i deprecar els camps suffix.)
- **`hero_slide_translations`**: `slide_id`, `language_code`, `title`, `subtitle`, `cta_label`  
  (Mateix patró: migrar dades dels camps `*_ca`/`*_es` actuals.)

Cada taula:
1. PK composta `(entity_id, language_code)` + FK a `languages(code)` i a l'entitat amb `ON DELETE CASCADE`.
2. GRANTs: `SELECT` a `anon`+`authenticated`, escriptura via RLS (només admin).
3. RLS: lectura pública; escriptura `is_admin(auth.uid())`.

### Cobertura ja existent (verificar)

- `product_translations`, `category_translations`, `variant_type_translations`, `list_template_translations`, `order_status_translations`, `order_status_email_templates` — comprovar que tenen FK a `languages` o convertir `language_code` a referenciar la nova taula.

### UI admin per editar

A cada formulari (producte, categoria, marca, slide, bloc CMS, secció de llista, plantilla, estat):
- Tabs per idioma (poblats des de `useLanguages()`).
- Camps tradu\u00efbles per tab; persistir a `<entity>_translations`.
- Quan s'afegeix un idioma nou, els tabs apareixen buits automàticament.

### Lectura al frontend

- Hooks existents (`useTranslatedProducts`, etc.) ja seleccionen `language_code = currentLang`. Estendre patró als hooks/components que llegeixen brands, hero_slides, cms_blocks, list_sections.

## 5. Detalls tècnics

- **Migració de dades CMS/Hero**: copiar `title_ca`→row `language_code=ca`, `title_es`→row `language_code=es`, mantenir columnes `*_ca`/`*_es` un temps (deprecades) i fer un PR posterior per eliminar-les un cop el frontend ja llegeixi de les noves taules.
- **Cap canvi a `auth`/`storage`** schemas.
- **Sense `ALTER DATABASE`**.
- Selector d'idioma persisteix a `localStorage` (clau `i18nextLng`), igual que avui.
- Edge functions que enviin correus llegiran l'idioma de la comanda/client (camp `language_code` ja present a `orders`?) — verificar i estendre si cal.

## Ordre d'execució

1. Migració BD: crear `languages`, sembrar `ca`/`es`, crear 4 noves taules `*_translations`, migrar dades de `cms_blocks` i `hero_slides`.
2. Moure ítem SMTP al grup Configuració.
3. Pàgina admin `/admin/idiomes` + hook `useLanguages` + selector a headers.
4. Refactor `i18n.ts` per fer servir idiomes dinàmics.
5. Ampliar `ca.json`/`es.json` i substituir strings hardcodejats a admin.
6. Afegir tabs d'idioma als formularis d'entitats noves (brands, hero, cms, list sections).
7. Actualitzar lectures de frontend (Footer, Home, llistes) per llegir de les noves taules de traducció.

## Què no inclou

- No es tradueix automàticament res (sense crida a IA de traducció). Es deixa preparat un punt clar on afegir-ho més endavant si vols.
- No es canvia la URL per idioma (`/es/...`). Es manté un sol arbre de rutes amb idioma a `localStorage`.
