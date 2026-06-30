
## Objetivo
Añadir **subfamilias** dentro de cada familia de lista de nacimiento, permitir que un producto pertenezca hasta a **3 pares (familia, subfamilia)**, y que la vista de creación de listas muestre los productos agrupados por familia → subfamilia.

## Cambios de base de datos

1. Nueva tabla `default_list_subsections`
   - `id`, `section_id` (FK a `default_list_sections`), `slug`, `sort_order`, `is_active`
2. Nueva tabla `default_list_subsection_translations`
   - `id`, `subsection_id`, `language`, `name`
3. Nueva tabla `product_default_sections` (sustituye en uso al campo único `products.default_section_id`)
   - `product_id`, `section_id`, `subsection_id` (nullable), `position` (0..2)
   - PK compuesta `(product_id, position)`
   - Mantenemos `products.default_section_id` por compatibilidad (sincronizado con `position=0`) hasta migrar todo el código.
4. Seed inicial con las familias y subfamilias del cartel (CA), traducciones ES generadas (mapeo manual). Las familias existentes (`default_list_sections`) se reutilizan; las que falten se crean.

## Cambios admin (ficha de producto)

En `AdminProductForm.tsx`, sección **"Famílies a la Llista de Naixement"**:
- Hasta 3 filas. Cada fila: `<select Família>` + `<select Subfamília>` (filtrado por familia).
- Botón "Afegir família" (max 3) y "Eliminar".
- Guardado en `product_default_sections` (reemplazo completo en cada guardado).
- Mantener `default_section_id` = sección de `position=0`.

Nueva pantalla **`/admin/families-llista`** (renombrar `AdminDefaultListSections`) con árbol: familia → subfamilias con CRUD + traducciones (LanguageTabs).

## Cambios cliente (selector de productos en listas)

`FamilyProductSelector.tsx` + `useFamilyProducts.ts`:
- Cargar `product_default_sections` con join a subfamilia.
- Para cada familia: cabecera, y dentro un bloque por cada **subfamilia** con sus productos.
- Productos sin subfamilia → bloque "General" al inicio.
- Un producto puede aparecer en más de una familia/subfamilia (según sus asignaciones).

## Traducciones i18n
Añadir claves: `admin.product.families` (singular/plural), `admin.product.addFamily`, `list.subsection.general`, etc., en `ca.json` y `es.json`.

## Validaciones
- Trigger BEFORE INSERT/UPDATE en `product_default_sections`: si `subsection_id` no es null, validar que pertenece a `section_id`.
- Máximo 3 filas por producto (UNIQUE + check en frontend).

## Detalles técnicos
- RLS: lectura pública (anon + authenticated), escritura solo admin (`is_admin`). GRANTs explícitos.
- Tipos Supabase se regeneran tras la migración.
- Compatibilidad: la UI antigua que lee `default_section_id` seguirá funcionando.

¿Apruebas que proceda con la migración y el desarrollo en este orden?
