## Rediseño de "Mi Lista" en Mi Cuenta

Reformular `src/pages/MyBirthListPage.tsx` para que el flujo sea claro y guiado, en tres bloques visibles según el estado del usuario.

### Estructura nueva

1. **Información de la lista** (cabecera con icono y descripción corta, sin cambios funcionales).

2. **Grid de mis listas**
   - Carga todas las listas vinculadas a la cuenta (`list_owners` → `birth_lists`).
   - Tarjetas visualmente alineadas con el resto de la web (mismo estilo que `ProductCard`: card con padding, título Playfair, badges de estado, código MUSSOLET-…, fecha prevista, número de productos).
   - Cada tarjeta tiene acciones: **Editar**, **Ver pública**, **Copiar código**, **Eliminar**.
   - Al final del grid, tarjeta-botón **"Crear una lista nueva"** (estilo dashed border + icono `Plus`) **solo si** `listas.length < 10`.
   - Si está al máximo (10), se oculta el botón y se muestra un aviso "Has alcanzado el máximo de 10 listas".

3. **Panel de creación (desplegable inline)**
   - Al pulsar "Crear una lista nueva", se despliega justo debajo del grid un panel con dos pestañas/tarjetas grandes:
     - **Plantilla predefinida** → grid de plantillas del admin (`list_templates` activas), cada una como tarjeta clicable con su descripción.
     - **Lista personalizada** → inputs de nombre en Catalán y Castellano + botón "Empezar".
   - Tras escoger una opción se entra al editor:
     - **Plantilla** → editor precargado con sus secciones y productos; el cliente puede eliminar elementos o secciones que no le convenzan, reordenar, y guardar.
     - **Personalizada** → editor vacío. Primero crea una sección (con nombre CA/ES), luego abre el catálogo de productos (con imágenes) para arrastrar/añadir a esa sección. Repite por sección.
   - Botón final **"Guardar lista"** que la añade al grid.

### Reglas

- Productos siempre con miniatura (`product_images` o placeholder).
- Atributos/variante fijados al crear: cuando una lista pública se consume, el visitante **no** puede cambiar la variante elegida (color, talla, etc.). Aplicar este bloqueo en la vista pública (`BirthListViewPage.tsx` / `PublicListSteps.tsx`): si `list_item.variant_id` no es null, ocultar selector de variantes y mostrar la variante fijada con tag "Configuración escogida por la familia".
- Mantener todo el backend actual (tablas `birth_lists`, `list_items`, `list_sections`, `list_owners`, `list_templates`). No se requiere migración SQL.
- Mantener i18n (claves `ca.json` / `es.json`); añadir las nuevas etiquetas.

### Archivos a modificar

- `src/pages/MyBirthListPage.tsx` — reestructura completa de la vista (grid + creador + editor) reutilizando los helpers ya existentes (`persistSectionsOrder`, drag-and-drop, búsqueda de productos, plantillas).
- `src/pages/BirthListViewPage.tsx` y/o `src/components/list/PublicListSteps.tsx` — bloquear cambio de variante cuando `variant_id` está fijado.
- `src/locales/ca.json`, `src/locales/es.json` — nuevas etiquetas (`myList.createNew`, `myList.maxReached`, `myList.choosePreset`, `myList.customList`, `myList.nameCa`, `myList.nameEs`, `publicList.variantLocked`, etc.).

### Notas técnicas

- El estado `view: 'list' | 'editor'` se amplía con `'list' | 'create-choice' | 'editor'` para soportar el desplegable de elección plantilla/personalizada.
- Para la card "Crear nueva", reutilizar tokens (`border-dashed border-primary/40`, hover suave).
- Para el catálogo embebido en modo personalizado, reutilizar la query de búsqueda actual (`productSearch`) y añadir un grid con imagen + nombre + botón "+".
- Bloqueo de variante en vista pública: en el selector actual, si el item tiene `variant_id` no nulo, renderizar `<Badge>` con el nombre de la variante en vez del `<Select>`.

### Fuera de alcance

- No se cambia el backend ni se añaden migraciones.
- No se modifica el panel admin de plantillas.
- No se cambia el checkout ni la lógica de compra.