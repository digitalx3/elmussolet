## Funcionalitats sol·licitades

1. **Traducció automàtica amb IA per a idiomes nous** — quan l'admin afegeix un idioma, ha de poder traduir manualment cada cadena i, alternativament, prémer "Traduir amb IA" perquè es tradueixin totes les cadenes i continguts d'una vegada. El botó queda desactivat si no s'ha configurat cap API key d'IA.
2. **Generació de descripcions SEO amb IA** a la fitxa del producte (descripció curta + descripció llarga optimitzades per SEO/GEO).

---

## 1. Proveïdor d'IA: dues opcions

Lovable ja inclou un **AI Gateway** (sense que l'admin hagi de gestionar cap clau) que dóna accés a models Gemini, GPT-5, Claude, etc. Tot i així, demanes "API key d'OpenAI o Claude que afegeix l'administrador". Et proposo aquest enfocament híbrid:

- **Pantalla `/admin/configuracio/ia`** nova amb tres opcions seleccionables:
  - *Lovable AI (recomanat)* — actiu per defecte, no requereix clau.
  - *OpenAI* — l'admin enganxa la seva `OPENAI_API_KEY` (es desa com a secret de Supabase).
  - *Anthropic / Claude* — `ANTHROPIC_API_KEY` (secret).
- Es desa quin proveïdor està actiu a `site_settings` (camp `ai_provider`: `lovable | openai | anthropic`).
- Els botons "Traduir amb IA" i "Generar descripció SEO" estaran **deshabilitats només si el proveïdor seleccionat és OpenAI/Anthropic i la seva clau no està present**. Si el proveïdor és Lovable, sempre estan actius.

---

## 2. Traducció d'idiomes nous

### 2.1 Cadenes d'interfície (`src/locales/*.json`)
Avui ca i es estan compilades dins el bundle. Per a idiomes nous afegits a l'admin necessitem desar les traduccions a la BD:

- Nova taula `ui_translations(language_code, key, value)`.
- A l'arrencada, després de carregar `useLanguages`, es fan `addResourceBundle` a i18next amb les files trobades per a cada idioma habilitat (overlay sobre el JSON estàtic per a ca/es).

### 2.2 Pantalla d'edició per idioma (`/admin/idiomes/:code/traduccions`)
- Llista totes les claus aplanades de `ca.json` (idioma per defecte) com a referència.
- Per cada clau: input editable amb el valor en aquest idioma (manual).
- Cerca/filtre per clau o text.
- Botó **"Traduir amb IA"** dalt — omple en lot totes les claus encara buides traduint des de l'idioma per defecte. Mostra progrés i permet revisar abans de desar.
- Botó "Desa" per persistir a `ui_translations`.

### 2.3 Continguts dinàmics ja existents
Quan s'activa un idioma nou, també es poden traduir per IA en lot els valors de:
- `product_translations` (nom, descripció curta, descripció llarga)
- `category_translations`, `brand_translations`
- `list_section_translations`, `default_list_section_translations`
- `cms_block_translations`, `hero_slide_translations`, `variant_type_translations`, `order_status_translations`

Mateix botó "Traduir amb IA" a la pantalla de l'idioma fa un job per omplir tot el que falti, agafant com a origen el text de l'idioma per defecte.

### 2.4 Edge function `ai-translate`
- Rep: `{ provider, items: [{ source_text, context? }], target_language, source_language }`.
- Tria proveïdor segons `site_settings.ai_provider` (o el que rebi).
- Llegeix la clau (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) o usa `LOVABLE_API_KEY`.
- Tradueix en lots de ~50 strings amb un únic prompt JSON per minimitzar cost.
- Retorna `{ translations: [...] }` en el mateix ordre.
- Validació, control d'errors 402/429, missatges clars al client.

---

## 3. Descripcions SEO amb IA al producte

- Botó **"Generar amb IA"** dins la targeta "Traduccions" de la fitxa de producte, just sota cada pestanya d'idioma (o un únic botó que actua sobre l'idioma actiu).
- En clicar: invoca edge function `ai-product-seo` amb `{ sku, name, current_short, current_long, language, brand?, category? }`.
- L'edge function demana al model dues cadenes optimitzades per SEO + GEO (paraules clau locals, intent comercial) amb estructura JSON `{ short_description, description }`.
- El resultat omple els camps de l'idioma actiu (l'admin pot editar abans de desar).
- Funciona amb el mateix proveïdor configurat al pas 1; deshabilitat amb la mateixa lògica.

---

## 4. Detalls tècnics

```text
DB
├─ ui_translations (language_code FK, key, value, updated_at)  RLS: admin write, anon read
├─ site_settings: nou camp `ai_provider text default 'lovable'`
└─ secrets: OPENAI_API_KEY, ANTHROPIC_API_KEY (opcionals, via add_secret)

Edge functions
├─ ai-translate         (batch translate strings)
└─ ai-product-seo       (per producte)

Frontend
├─ src/i18n.ts          → carregar overlay de ui_translations
├─ src/pages/admin/AdminAiSettings.tsx           (nou)
├─ src/pages/admin/AdminLanguageTranslations.tsx (nou, per idioma)
├─ src/pages/admin/AdminLanguages.tsx            (afegir enllaç "Traduir")
├─ src/pages/admin/AdminProductForm.tsx          (botó SEO per idioma)
└─ src/hooks/useAiProvider.ts                    (estat del proveïdor + disponibilitat)
```

---

## 5. Què faré primer (en aquest ordre)

1. Migració: `ui_translations` + camp `ai_provider` a `site_settings`.
2. Pantalla `/admin/configuracio/ia` (seleccionar proveïdor, demanar secrets si cal, indicador d'estat).
3. Edge function `ai-translate` + hook `useAiProvider`.
4. Pantalla per idioma amb edició manual + botó "Traduir amb IA" (cobreix UI strings + continguts dinàmics).
5. Overlay de `ui_translations` a i18next.
6. Edge function `ai-product-seo` + botó a `AdminProductForm`.

---

## Preguntes abans de començar

- Confirmes que vols mantenir l'opció **OpenAI/Anthropic amb clau pròpia** o prefereixes anar directament amb **Lovable AI Gateway** (més senzill, sense que hagis de gestionar cap clau)?
- Quan generem descripcions SEO amb IA al producte, vols que **sobreescrigui** sempre el contingut actual o que només ompli si està buit (i mostri preview abans de desar)?

Si confirmes, començo per la migració i la pantalla de configuració d'IA.
