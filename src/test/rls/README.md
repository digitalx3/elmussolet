# Proves automàtiques de RLS

Suite d'integració que valida que cada rol (anon, usuari autenticat, propietari de llista, admin, super_admin) només pot llegir/escriure el que les polítiques permeten, i que les funcions `SECURITY DEFINER` retornen `forbidden` quan toca.

## Què cobreix

- `select-matrix.test.ts` — matriu de SELECT per a taules públiques, només-admin, només-autenticat i propietat.
- `mutation-guards.test.ts` — bloqueig d'INSERT/UPDATE/DELETE prohibits (auto-escalada de rols, SMTP, manteniment, llistes alienes…).
- `rpc.test.ts` — `is_admin`, `is_super_admin`, `has_role`, `get_maintenance_settings_admin`, `get_top_products`, `get_list_purchases`, `user_owns_list`.

## Com s'executa

```bash
bun run test:rls
```

La suite no entra al `bun test` per defecte (afecta dades reals i requereix xarxa).

## Requisits

1. `.env` amb `VITE_SUPABASE_URL` i `VITE_SUPABASE_PUBLISHABLE_KEY` (ja existents al projecte).
2. Credencials d'un compte amb rol `admin` o `super_admin` per arrencar el seed:

```bash
TEST_ADMIN_EMAIL=admin@elmussolet.com
TEST_ADMIN_PASSWORD=...
```

Per defecte usa `admin@elmussolet.com` / `Admin2026!Mussolet` (compte de test del projecte).

## Què crea el seed

L'edge function `rls-test-setup` (idempotent, només invocable per admins) provisiona:

- 4 usuaris fixtures a `@rlstest.local`: `test-user`, `test-owner`, `test-admin`, `test-super` (contrasenya `RlsTest!2026#Mussolet`).
- Una llista de naixement `RLS-TEST-LIST` (password `rlstest`) propietat de `test-owner`, amb una secció i una traducció.
- Rols `admin` i `super_admin` assignats als comptes corresponents via `user_roles`.

Les dades es poden esborrar manualment des de l'admin si cal, però són segures de mantenir entre execucions.
