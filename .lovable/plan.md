
# 8. Apartado exclusivo Super Admin

## Resumen
Crear una sección "Super Admin" visible solo para super_admin que permita gestionar qué admins tienen acceso a IA, Historial IA, Traducciones y SMTP (extensible). Aplicar los permisos de forma real en menú, rutas y backend, manteniendo los accesos actuales de todos los admins (migración no disruptiva: backfill con todos los permisos activos + activar el enforcement).

## 1. Base de datos (migración)

- Añadir valor `ai_history` al enum `app_permission` (ya existen `ai_features`, `manage_smtp`, `manage_translations`, `manage_backups`, `manage_users`, `manage_cookies`).
- Backfill no disruptivo: para cada usuario con rol `admin` (no super_admin) en `user_roles`, insertar en `user_permissions` todas las claves del enum si no existen.
- Activar `site_settings.permissions_enforced = true` (insert si falta). El helper `has_permission` ya respeta este flag y el super_admin siempre pasa.
- RLS de `user_permissions`: garantizar que solo super_admin pueda INSERT/UPDATE/DELETE; SELECT permitido al propio usuario y a super_admin. Revisar y corregir políticas existentes si hace falta.

## 2. Mapa de claves de permiso

| Función | Clave | Rutas afectadas |
|---|---|---|
| IA | `ai_features` | `/admin/ia` + edge `ai-translate`, `ai-product-seo`, botones de IA en formularios |
| Historial IA | `ai_history` | `/admin/ia/historial` |
| Traducciones | `manage_translations` | `/admin/traduccions`, `/admin/idiomes`, `/admin/idiomes/:code/traduccions` |
| SMTP | `manage_smtp` | `/admin/smtp` |

El super_admin siempre tiene acceso total (vía `is_super_admin` en `has_permission` y `can()` en el frontend).

## 3. Frontend — control de acceso

- **Nuevo guard `PermissionRoute`** en `src/components/auth/ProtectedRoute.tsx` que usa `can(perm)`; si falta permiso → redirige a `/admin` con toast "Acceso denegado". Envolver con él las rutas listadas arriba en `AdminDashboard.tsx`.
- **Nuevo guard `SuperAdminRoute`** para las rutas exclusivas (`/admin/super`).
- **Menú lateral** (`AdminLayout.tsx`):
  - Filtrar items por `can(perm)` con un nuevo campo opcional `perm` en `NavItem`.
  - Añadir nuevo grupo `superAdmin` (label "Super Admin") visible solo si `isSuperAdmin`, con item "Permisos d'administradors" → `/admin/super/permisos`.
- Esconder botones/acciones de IA en `AdminProductForm` y similares cuando `!can('ai_features')`.

## 4. Pantalla de gestión de permisos

`src/pages/admin/AdminSuperPermissions.tsx` montada en `/admin/super/permisos`:

- Carga vía `admin-manage-users` (ya existente) o consulta directa: lista de usuarios con rol `admin` (excluye super_admin).
- Buscador por nombre/email.
- Para cada admin: tabla/cards con switches para `ai_features`, `ai_history`, `manage_translations`, `manage_smtp` (driven por una constante `PREMIUM_PERMISSIONS` para extender fácil).
- Guardar via upsert/delete en `user_permissions` (RLS bloquea a no-super).
- Estados: loading, empty, toast de confirmación/error.
- Refresca permisos del usuario afectado.

## 5. Backend — control real

Editar las edge functions sensibles para validar el JWT del caller y comprobar `has_permission` antes de actuar:

- `supabase/functions/ai-translate/index.ts` → requiere `ai_features`.
- `supabase/functions/ai-product-seo/index.ts` → requiere `ai_features`.
- `supabase/functions/send-smtp-email/index.ts` (envío admin/test) → requiere `manage_smtp` cuando se invoca desde el panel admin.
- `admin-manage-users/index.ts` → ya bloquea modificar super_admin; añadir que **un admin normal no pueda tocar `user_permissions` ni promover roles**.

Patrón: leer `Authorization`, `supabase.auth.getUser(token)`, llamar a RPC `has_permission(uid, '<clave>')`. Si falla → 403.

## 6. Migración no disruptiva (orden)

1. Migración SQL: añade enum value, backfill permisos, activa `permissions_enforced`.
2. Deploy del frontend con guards y nueva sección.
3. Deploy edge functions con validación.

Todos los admins existentes mantienen acceso porque tienen todas las claves en `user_permissions`. El super_admin podrá empezar a revocar selectivamente.

## 7. Detalles técnicos

- `PREMIUM_PERMISSIONS` exportado desde `src/lib/permissions.ts` (única fuente para UI y validaciones).
- `NavItem.perm?: string` opcional; filtrado en el render del menú.
- El `AuthContext` ya expone `can()`, `isSuperAdmin`, `permissions`; no requiere cambios estructurales (solo confirmar que `permissions` se refresca tras cambios — añadir `refreshProfile()` tras guardar en la pantalla del super admin).

## 8. Pruebas

- Login super_admin → ve grupo "Super Admin" y `/admin/super/permisos`.
- Login admin normal → no ve el grupo; navegación manual a `/admin/super/permisos` redirige.
- Super admin desactiva `ai_features` a un admin → ese admin pierde `/admin/ia` del menú, acceso directo redirige, y las edge functions IA devuelven 403.
- Igual para `ai_history`, `manage_translations`, `manage_smtp`.
- Admin actual sin tocar nada conserva todos sus accesos tras la migración.

