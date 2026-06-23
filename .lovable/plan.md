
# Feedback al editar productos bloqueados

## Objetivo
Cuando el cliente intente modificar un producto bloqueado (con compras pagadas) en `MyBirthListPage`, mostrar un toast claro que explique:
- Por qué está bloqueado (hay compras pagadas).
- Qué cambios estarían permitidos si todas las compras estuvieran en estado `pending` (cantidad, prioridad, sección, eliminar).
- Qué no se puede hacer una vez hay pagos confirmados.

## Cambios en `src/pages/MyBirthListPage.tsx`

1. **Importar `toast` de `sonner`** (ya disponible globalmente en el proyecto).

2. **Helper `notifyLocked(reason)`** que muestre `toast.error` con:
   - Título: "Producte bloquejat"
   - Descripción: "Aquest producte té compres pagades i no es pot {acció}. Només es permeten canvis (quantitat, prioritat, secció, eliminar) mentre totes les compres estiguin pendents."
   - Versión castellana equivalente vía i18n si la página ya usa `t()`.

3. **Quitar `disabled` puro y añadir handlers** en los controles afectados cuando `hasPaid === true`:
   - `<select>` de sección → `onMouseDown`/`onClick` que llama `notifyLocked('reassignar de secció')` y previene apertura. Mantener visualmente "deshabilitado" (opacidad) pero interactivo para capturar el click.
   - `Input` de cantidad → `onFocus`/`onClick` con `notifyLocked('canviar la quantitat')`, `readOnly` en lugar de `disabled`.
   - `Select` de prioridad → wrapper `div` con `onClickCapture` que dispara toast y `e.preventDefault()`.
   - Botón eliminar → `onClick` muestra toast en vez de ejecutar la mutación.
   - `draggable` se mantiene en `false`; añadir `onDragStart` con toast por si el navegador lo intenta.

4. **Para items pendientes (`!hasPaid`)**: sin cambios de comportamiento. Los controles siguen activos.

5. **Mantener** el badge y tooltip existentes ("Bloquejat" / "Editable (pendent)") como refuerzo visual.

## Detalles técnicos
- Un único helper centraliza el mensaje para no duplicar texto.
- Se usa `sonner` (ya montado en `App.tsx`) → no requiere cambios de providers.
- No se modifica lógica de BD, RLS ni la query `get_list_purchases`.
- No se tocan rutas, contextos ni traducciones globales más allá de añadir 2 claves opcionales en `src/locales/ca.json` y `es.json` si la página ya consume `t()` (verificar al implementar).

## Archivos afectados
- `src/pages/MyBirthListPage.tsx` (único cambio funcional).
- Opcional: `src/locales/ca.json`, `src/locales/es.json` (claves de mensaje).
