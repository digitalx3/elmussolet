
# Plan d'implementació

## 1. Productes — Preu amb / sense IVA + oferta com a preu brut

**Base de dades**
- `products`: afegir `base_price_with_tax numeric` (nullable, calculat) i `sale_value_with_tax numeric` (nullable). No es toca `base_price` ni `sale_value` per no trencar el frontend públic.
- Trigger `products_sync_tax_prices` (BEFORE INSERT/UPDATE):
  - Resol `tax %` (per `tax_rate_id` del producte o `tax_rates.is_default`).
  - Si només arriba un dels dos preus → calcula l'altre.
  - Manté `base_price` com a font (preu sense IVA) i recalcula `base_price_with_tax` sempre.
  - Per a `sale_value`: si `sale_price_type='fixed'`, recalcula `sale_value_with_tax`. Si `sale_price_type='percentage'`, deixa `sale_value_with_tax = NULL`.
- Backfill: omplir `base_price_with_tax` / `sale_value_with_tax` per a tots els productes existents.

**Frontend admin (`AdminProductForm.tsx`)**
- Dins de la card de "Preus": dos inputs sincronitzats `Preu sense IVA` ↔ `Preu amb IVA`, amb badge del % IVA aplicat. L'últim camp editat és la font; helper `syncPrices(side, value, taxPct)` evita bucles (estat local `lastEdited`).
- Validacions: numèric, ≥ 0, max 6 decimals interns, mostrats com a moneda EUR (`formatPrice`).
- Card "Oferta": etiquetar com **"Preu d'oferta (IVA inclòs)"** quan `sale_price_type='fixed'`. Mostrar a sota el preu net equivalent calculat. La validació actual (fixed < base) compara en brut vs brut.
- En desar, enviar tots dos camps; el trigger garanteix la coherència.

**Frontend públic / pricing**
- `src/lib/pricing.ts`: continuar treballant amb `base_price` (net) com avui per no canviar càlculs de carret/checkout/factures. El preu d'oferta fixed s'emmagatzema com a net (`sale_value`) i la versió bruta (`sale_value_with_tax`) només per mostrar i per al formulari admin.
- Resum: el client final continua veient preu brut (com avui via `priceWithTax`), però el camp d'oferta ara és garantit coherent amb el brut introduït per l'admin.

## 2. Dashboard — Top productes venuts amb filtre per mes

**`AdminOverview.tsx`**
- Nou bloc "Productes més venuts" amb `<Select>` de mes (últims 12 mesos, default = mes actual).
- Query React-Query `top-products-by-month`:
  ```sql
  select p.id, coalesce(pt.name, p.slug) as name, sum(oi.quantity) as units
  from order_items oi
  join orders o on o.id = oi.order_id
  join products p on p.id = oi.product_id
  left join product_translations pt on pt.product_id = p.id and pt.language_code = :lang
  where o.created_at >= :from and o.created_at < :to
    and o.status not in ('cancelled','refunded')
  group by p.id, pt.name, p.slug
  order by units desc limit 10;
  ```
  Implementat client-side via dos selects de Supabase (sense RPC nou) o RPC `get_top_products(_from, _to)` `SECURITY DEFINER` restringit a admin per evitar dependre de RLS dels `order_items`. Preferim RPC.
- Render amb `recharts` (ja instal·lat) — `BarChart` horitzontal reutilitzant `chartConfig`.
- Empty state amb missatge traduït.

## 3. Traduccions del backoffice

- Auditar tots els fitxers sota `src/pages/admin/**` i `src/components/admin/**` amb `rg` per literals catalans/castellans hardcoded.
- Afegir claus que falten a `src/locales/ca.json` i `src/locales/es.json` sota namespaces `admin.*` (products, dashboard, users, orders, settings, validations, common).
- Substituir strings per `t('admin.x.y')`. Prioritat: capçaleres de pàgina, botons, columnes de taula, missatges toast, validacions, tabs.
- Verificar que `AdminLanguageSwitcher` canvia l'idioma i que `i18n` persisteix (`i18nextLng`).
- No es modifiquen continguts dinàmics (productes, CMS) — ja tenen taules de traducció.

## 4. Super Admin + permisos granulars

**Model de rols (substitueix `profiles.role` text per `user_roles`)**
- Nou enum `public.app_role` amb valors `super_admin`, `admin`, `customer`.
- Nova taula `public.user_roles(user_id, role, unique(user_id, role))` amb RLS (només `super_admin` modifica; tothom autenticat llegeix el seu propi).
- Funcions `SECURITY DEFINER`:
  - `has_role(_uid, _role)` — ja patró conegut.
  - `is_super_admin(_uid)` — wrapper.
  - `is_admin(_uid)` reescrita: retorna `true` si l'usuari és `admin` **o** `super_admin` (manté compatibilitat amb totes les policies actuals).
- Migració de dades: per a cada `profiles.role='admin'` → insertar fila a `user_roles` amb `'admin'`. Crear fila `super_admin` per al compte indicat (per defecte `admin@elmussolet.com`; configurable via parametre de migració).
- `profiles.role` es manté per compatibilitat read-only però deixa de ser font de veritat per autorització.

**Permisos granulars**
- Enum `public.app_permission` amb valors inicials: `ai_features`, `manage_backups`, `manage_users`, `manage_cookies`, `manage_smtp`, `manage_translations`. Es pot ampliar.
- Taula `public.user_permissions(user_id, permission, granted_by, granted_at, unique(user_id, permission))`.
- Funció `has_permission(_uid, _perm)`:
  - `true` si `is_super_admin(_uid)`.
  - `true` si `is_admin(_uid)` **i** existeix fila a `user_permissions`.
  - **Estat inicial**: per no treure cap funció a ningú, `has_permission` retorna també `true` quan `is_admin(_uid)` i no s'ha activat encara el "permission enforcement mode" (flag a `site_settings.value->'permissions_enforced' = false`). Quan el Super Admin l'activi, passa a comprovar `user_permissions`.
- RLS: només `super_admin` pot `INSERT/DELETE` a `user_permissions`.

**Backend (Edge Functions)**
- `admin-manage-users`: bloquejar qualsevol acció (update/delete/role-change) sobre un usuari `super_admin` si el caller no és `super_admin`. Filtrar `super_admin` de la resposta de llista quan el caller no és `super_admin`.
- Nova edge `admin-manage-permissions` (només `super_admin`): list/grant/revoke permisos.
- Edges sensibles (`ai-translate`, `ai-product-seo`, `admin-backup-*`): verificar `has_permission` corresponent abans d'executar.

**Frontend**
- `AuthContext`: exposar `isSuperAdmin`, `isAdmin`, `permissions: string[]`, helper `can(perm)`.
- `ProtectedRoute`: nova prop opcional `requirePermission`.
- `AdminUsers.tsx`: amagar files amb rol `super_admin` (ja filtrat al backend); deshabilitar acció editar/eliminar si target és super_admin. Botó "Permisos" només visible per super_admin → obre modal de toggles de `app_permission`.
- Nova ruta `/admin/super` (només `super_admin`) amb gestió de Super Admins i activació del "enforcement mode".
- Aplicar `can('ai_features')` als botons d'IA, `can('manage_backups')` a `/admin/backups`, etc. — amb el flag desactivat es comporta com avui.

**Seguretat**
- Totes les policies admin existents segueixen funcionant perquè `is_admin` ara cobreix tant `admin` com `super_admin`.
- Validació duplicada frontend+backend; el frontend només amaga UI.
- Audit log: `user_permissions.granted_by` i timestamp.

## 5. Detalls tècnics

```text
Migracions (ordre):
 1. add columns products.base_price_with_tax, products.sale_value_with_tax + trigger + backfill
 2. enum app_role + user_roles + GRANTs + RLS + has_role/is_super_admin + reescriure is_admin
 3. seed user_roles des de profiles.role + super_admin inicial
 4. enum app_permission + user_permissions + GRANTs + RLS + has_permission
 5. RPC get_top_products(_from timestamptz, _to timestamptz)
```

Llibreries: cap nova (recharts, react-query, i18next ja presents).

## 6. Entregables i verificacions
- Sincronització bidireccional de preus sense bucles (test manual als dos inputs).
- Oferta fixed: introduir 10 € amb IVA 21 % → `sale_value` net = 8.264.
- Dashboard: bar chart respon al canvi de mes, empty state visible al canviar a mes sense vendes.
- i18n: canviar idioma a `/admin` tradueix menús, botons, validacions.
- Super Admin invisible per a admins; admin no pot tocar-lo; super admin pot atorgar/retirar `ai_features` i el botó d'IA desapareix a l'admin afectat un cop activat l'enforcement.
- Tots els admins actuals conserven accés fins activar enforcement.
