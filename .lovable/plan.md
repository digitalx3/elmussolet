
# Còpies de seguretat amb clients desacoblats

Dos blocs independents però lligats: primer reestructurem clients per fer-los restaurables, després construïm el sistema de backup/restore.

---

## Bloc 1 — Taula `customers` desacoblada d'`auth.users`

### Esquema nou

Crear `public.customers` com a font única de dades de client (independent de qui té login):

```text
customers
  id uuid PK
  email text UNIQUE NOT NULL
  full_name text
  phone, address_line1, address_line2, city, postal_code, province, nif, company_name
  preferred_language text DEFAULT 'ca'
  auth_user_id uuid NULL  → auth.users(id) ON DELETE SET NULL
  deleted_at timestamptz NULL
  created_at, updated_at
```

- `auth_user_id` és **opcional**: només es lliga quan el client té compte. Els compradors convidats (checkout sense registre) també tenen fila a `customers`.
- RLS: l'admin veu/edita tot; un usuari autenticat veu/edita la seva fila via `auth_user_id = auth.uid()`.

### Re-enllaçat de taules

- `orders`: afegir `customer_id uuid NOT NULL → customers(id)`. Mantenim `user_id` durant la migració, després `DROP`.
- `list_owners`: afegir `customer_id uuid → customers(id)`. `user_id` queda com a info opcional o es retira.
- `profiles`: queda només com a **perfil d'autenticació** (rol, idioma de la UI, soft-delete d'usuari). Les dades de contacte/adreça es mouen a `customers`.

### Migració de dades existents

Dins de la mateixa migració:
1. Per cada `profiles` no esborrat, crear `customers` copiant nom/adreça/NIF/idioma i fixant `auth_user_id = profiles.id`, `email` agafat d'`auth.users` via funció `SECURITY DEFINER`.
2. Per cada `orders.user_id`, omplir `orders.customer_id` amb el `customers.id` corresponent.
3. Igual per `list_owners`.
4. Validar que no queda cap `orders.customer_id` NULL abans de fer-lo `NOT NULL`.

### Codi a actualitzar

- **Checkout** (`CheckoutPage.tsx`, `CartContext`): en crear pedido, `upsert` a `customers` per `email` i fer servir el `customer_id` retornat. Funciona igual per usuari autenticat o convidat.
- **Admin pedidos** (`AdminOrders.tsx`): mostrar dades del client via `customer` (no `profile`).
- **Admin llistes** (`AdminBirthListForm.tsx`, `AdminBirthListList.tsx`): mostrar propietaris via `customer`.
- **Compte d'usuari** (`AccountDashboard.tsx`, `MyBirthListPage.tsx`): llegir/editar dades de contacte des de `customers` (la seva fila on `auth_user_id = auth.uid()`).
- **Edge functions**: `admin-delete-birth-list`, `admin-manage-users`, `get-public-list-data`, `verify-list-access` — substituir referències a `profiles`/`user_id` per `customers`/`customer_id`.

### Nou apartat admin: **Clients**

A `AdminLayout` afegim `clients` dins del grup *Configuració* (o del grup *Vendes*). Llistat amb cerca, edició, soft-delete i veure els seus pedidos i llistes. Independent de la pestanya *Usuaris* (que segueix gestionant comptes d'auth + rols).

---

## Bloc 2 — Sistema de còpies de seguretat

### Bucket privat i taula d'historial

- Bucket nou `backups` (privat, només admins amb signed URLs).
- Taula `backup_runs` per registrar cada execució:

```text
backup_runs
  id, kind ('manual'|'scheduled'), status ('running'|'success'|'failed'),
  created_by uuid, file_path text, file_size_bytes bigint,
  tables_json jsonb (recompte per taula), storage_json jsonb (buckets/fitxers),
  error text, started_at, finished_at
```

### Edge function `admin-backup-create`

Només admin. Genera un ZIP amb:

```text
backup-YYYYMMDD-HHmm.zip
├─ manifest.json         (versió esquema, data, taules, comptatges, checksum)
├─ data/
│   ├─ customers.json
│   ├─ orders.json
│   ├─ order_items.json
│   ├─ products.json, product_variants.json, product_translations.json, product_images.json
│   ├─ brands.json, categories.json, category_translations.json
│   ├─ birth_lists.json, list_items.json, list_sections.json, list_owners.json
│   ├─ list_templates.json, list_template_items.json, list_template_sections.json, list_template_translations.json
│   ├─ hero_slides.json, cms_blocks.json
│   ├─ shipping_zones.json, shipping_rates.json, tax_rates.json
│   ├─ order_statuses.json, order_status_translations.json, order_status_email_templates.json
│   ├─ variant_types.json, variant_type_translations.json
│   ├─ smtp_settings.json, site_settings.json
│   └─ contact_messages.json
└─ storage/
    ├─ product-images/...
    ├─ brand-logos/...
    └─ site-assets/...
```

- Puja el ZIP a `backups/` i crea fila a `backup_runs`.
- **NO** inclou `auth.users`, `profiles`, `stock_movements`, `order_deletion_audit`, `smtp_send_log`, `backup_runs`.

### Edge function `admin-backup-restore`

Rep `{ backup_id, mode: 'upsert'|'wipe', groups: string[] }`. Descarrega el ZIP de Storage, valida `manifest.json` i aplica per grup en l'ordre correcte de FK:

- **Mode `upsert`**: `INSERT ... ON CONFLICT (id) DO UPDATE`. Files no presents al backup es conserven.
- **Mode `wipe`**: `DELETE FROM <taula> WHERE ...` només de les taules del grup seleccionat, després `INSERT` net. Respecta FKs eliminant primer les taules filles.
- Restaura també els fitxers de Storage del grup (sobreescriu per path).
- Retorna informe: files inserides/actualitzades/eliminades per taula, fitxers restaurats, errors.

### Grups de restauració seleccionables

A la UI l'admin marca quins grups vol restaurar i amb quin mode cadascun:

| Grup | Taules | Storage |
|---|---|---|
| Catàleg | products, product_variants, product_translations, product_images, brands, categories, category_translations, variant_types, variant_type_translations | product-images, brand-logos |
| Contingut | hero_slides, cms_blocks | site-assets |
| Configuració | shipping_zones, shipping_rates, tax_rates, order_statuses, order_status_translations, order_status_email_templates, smtp_settings, site_settings | — |
| Plantilles | list_templates, list_template_items, list_template_sections, list_template_translations | — |
| Clients i vendes | customers, orders, order_items, birth_lists, list_items, list_sections, list_owners | — |
| Missatges | contact_messages | — |

Gràcies a `customers` desacoblats, el grup *Clients i vendes* ja es pot restaurar íntegrament sense dependre d'`auth.users`. Si un client tenia compte i el seu `auth.users` ja no existeix, `auth_user_id` queda `NULL` i el client passa a ser "sense compte" (l'admin pot reassignar manualment).

### UI: `AdminBackups` dins del grup *Configuració*

- Botó **Crear còpia ara** → crida `admin-backup-create`, mostra progrés.
- Taula d'historial (`backup_runs`) amb: data, mida, autor, estat, accions.
- Per cada fila: **Descarregar** (signed URL del bucket `backups`), **Restaurar...** (obre modal), **Eliminar**.
- Modal de restauració:
  - Checkboxes per grup.
  - Radio `Upsert` / `Wipe + reimport` per cada grup marcat.
  - Avís vermell explícit per al mode `Wipe`, requereix escriure `RESTAURAR` per confirmar.
  - Botó **Executar restauració** → crida `admin-backup-restore`, mostra informe final.

### Detalls tècnics importants

- ZIP: llibreria `jszip` via `npm:` import a Deno.
- Streaming: per buckets grossos, fer servir signed download URLs i afegir-los al ZIP en streaming per no excedir memòria de l'edge function.
- Triggers de stock (`order_items_stock_trigger`, `orders_status_stock_trigger`) s'han de **desactivar temporalment** durant el restore del grup *Clients i vendes* per evitar moviments duplicats; tornar a activar al final. Es fa amb una funció `SECURITY DEFINER` `restore_set_triggers(_enabled bool)`.
- Validar `manifest.schema_version` per detectar backups incompatibles amb l'esquema actual.

---

## Ordre d'implementació

1. Migració esquema `customers` + re-enllaç `orders`/`list_owners` + migració de dades.
2. Actualitzar checkout, comptes, admin pedidos/llistes i edge functions per usar `customers`.
3. Nou apartat admin **Clients**.
4. Bucket `backups`, taula `backup_runs`, edge function `admin-backup-create`.
5. Edge function `admin-backup-restore` amb modes Upsert/Wipe per grup.
6. UI `AdminBackups` amb llistat, descàrrega, modal de restauració.

El bloc 1 és prerequisit del bloc 2: sense `customers` desacoblats el grup *Clients i vendes* no es pot restaurar de forma consistent.
