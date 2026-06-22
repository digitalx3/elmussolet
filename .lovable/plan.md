# Múltiples listas de nacimiento por usuario (máx. 10)

Actualmente `MyBirthListPage` solo carga **una** lista por usuario (la primera que encuentra en `list_owners`). Para soportar hasta 10 listas por cliente, hay que refactorizar la página y añadir un selector.

## 1. UI: nueva pantalla "Les meves llistes"

En `/compte/llista-naixement` (`MyBirthListPage.tsx`):

- Al entrar, si el usuario tiene **0 listas** → mostrar formulario de creación directamente (como ahora cuando `existing === null`).
- Si tiene **1 o más** → mostrar al inicio una rejilla de tarjetas con todas sus listas:
  - Cada tarjeta: nombre del bebé (o código), código de lista, estado (esborrany/activa/tancada), nº de productos, fecha esperada.
  - Botón "Editar" → abre el editor de esa lista.
  - Botón "Veure pública" → abre la vista pública.
- Botón superior "Crear nova llista":
  - Si `count < 10` (o usuario es admin) → abre el editor en modo creación con un nuevo `list_code`.
  - Si `count >= 10` y NO es admin → botón deshabilitado + mensaje: "Has arribat al màxim de 10 llistes. Contacta amb l'administrador per crear-ne més." con enlace a `/contacte`.
- Mientras se está editando/creando una lista concreta, mostrar un botón "← Tornar a les meves llistes" para volver al listado.

## 2. Estado interno

`MyBirthListPage` añade:
- `view: 'list' | 'editor'` (por defecto `'list'` si hay listas, `'editor'` si no hay ninguna).
- `editingListId: string | null` (null = creando nueva).
- Query `useQuery(['my-birth-lists', user.id])` que devuelve **todas** las listas del usuario (en lugar de `.limit(1)`).
- La query existente que carga una lista concreta se filtra por `editingListId` cuando `view === 'editor'`.

El flujo de guardado actual ya cubre crear y actualizar; solo hay que asegurar que al pulsar "Crear nova llista" se reseteen `listId`, `form` y `sections`.

## 3. Lógica de límite (frontend + backend)

**Frontend:** desactivar el botón "Crear nova llista" cuando `lists.length >= 10` y el perfil no es admin.

**Backend (seguridad real):** añadir un trigger `BEFORE INSERT` en `birth_lists` que cuente las listas del `auth.uid()` en `list_owners` (vía función `SECURITY DEFINER`) y lance error si supera 10, excepto si `public.is_admin(auth.uid())` es `true`. Así no se puede saltar el límite por API.

```sql
CREATE OR REPLACE FUNCTION public.enforce_birth_list_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  cnt int;
BEGIN
  IF uid IS NULL OR public.is_admin(uid) THEN
    RETURN NEW;
  END IF;
  SELECT count(*) INTO cnt FROM public.list_owners WHERE user_id = uid;
  IF cnt >= 10 THEN
    RAISE EXCEPTION 'BIRTH_LIST_LIMIT_REACHED' USING HINT = 'Max 10 lists per user';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER birth_lists_limit
BEFORE INSERT ON public.birth_lists
FOR EACH ROW EXECUTE FUNCTION public.enforce_birth_list_limit();
```

El frontend captura el error `BIRTH_LIST_LIMIT_REACHED` y muestra el mensaje correspondiente.

## 4. Traducciones

Añadir en `ca.json` / `es.json` bajo `list`:
- `myLists`, `createNew`, `backToLists`, `limitReached`, `contactAdmin`, `listsCount`, `editList`.

## 5. Fuera de alcance

- No se toca el panel admin (`AdminBirthListList`): el admin sigue creando sin límite desde allí.
- No se modifica la vista pública ni el carrito.

## Resumen de archivos

- `src/pages/MyBirthListPage.tsx` — refactor a vista lista + editor.
- `src/locales/ca.json`, `src/locales/es.json` — nuevas claves.
- Nueva migración SQL: trigger de límite en `birth_lists`.
