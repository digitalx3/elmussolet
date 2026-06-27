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

Abans d'arrencar Vitest, `pretest:rls` executa `scripts/check-rls-env.ts` i atura la suite ràpidament si falten `VITE_SUPABASE_URL` o `VITE_SUPABASE_PUBLISHABLE_KEY`.

La suite no entra al `bun test` per defecte (afecta dades reals i requereix xarxa).

## Configuració d'entorn (CI i local consistents)

`src/test/rls/env.ts` és l'única font d'env. Carrega variables amb aquesta precedència (la més alta guanya):

1. `process.env` real (CI via GitHub Actions, o exports al teu shell)
2. `.env.local` (gitignorat — overrides personals)
3. `.env.test`
4. `.env` (del projecte, ja conté `VITE_SUPABASE_URL` i `VITE_SUPABASE_PUBLISHABLE_KEY`)

Variables requerides:

| Variable | On es defineix per defecte |
| --- | --- |
| `VITE_SUPABASE_URL` | `.env` del projecte |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `.env` del projecte |
| `TEST_ADMIN_EMAIL` | secret CI / `.env.local` (default: `admin@elmussolet.com`) |
| `TEST_ADMIN_PASSWORD` | secret CI / `.env.local` (default: `Admin2026!Mussolet`) |

Si falta alguna obligatòria (`VITE_SUPABASE_*`), `getRlsEnv()` llança un error explicant què cal afegir.

### Local

Crea `.env.local` (gitignorat) amb el compte admin que vulguis usar:

```bash
TEST_ADMIN_EMAIL=admin@elmussolet.com
TEST_ADMIN_PASSWORD=Admin2026!Mussolet
```

### CI (GitHub Actions)

`.github/workflows/rls-tests.yml` executa `bun run test:rls` a cada PR i push a `main` (i manualment via `workflow_dispatch`). Configura els secrets al repo (Settings → Secrets and variables → Actions):

- `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD` — obligatoris.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — opcionals; només si vols apuntar a un backend diferent del del `.env` del repo.



## Què crea el seed

L'edge function `rls-test-setup` (idempotent, només invocable per admins) provisiona:

- 4 usuaris fixtures a `@rlstest.local`: `test-user`, `test-owner`, `test-admin`, `test-super` (contrasenya `RlsTest!2026#Mussolet`).
- Una llista de naixement `RLS-TEST-LIST` (password `rlstest`) propietat de `test-owner`, amb una secció i una traducció.
- Rols `admin` i `super_admin` assignats als comptes corresponents via `user_roles`.

Les dades es poden esborrar manualment des de l'admin si cal, però són segures de mantenir entre execucions.
