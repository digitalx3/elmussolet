## Plan: Ofertas, destacados, relacionados y modificadores de precio

Implementaremos 5 funcionalidades sin tocar la lógica existente de stock, listas o checkout. Todo se construye encima de los campos actuales (`base_price`, `price_override`) añadiendo columnas y tablas nuevas.

---

### 1. Precio en oferta por producto

**Base de datos** (migración `products`):
- `sale_price_type` (`'fixed' | 'percent' | null`)
- `sale_value` numeric (precio fijo en € o porcentaje 0–100)
- `sale_starts_at`, `sale_ends_at` timestamptz (nullable, vigencia opcional)

**Helper** (frontend, `src/lib/pricing.ts`):
- `getEffectivePrice(product, variant?)` → `{ base, final, discountPct, onSale, savings }`
- Considera oferta activa solo si `now` ∈ [start, end] (o sin fechas).
- Aplica primero el modificador de variante (ver §2) y después la oferta.

**Admin** (`AdminProductForm.tsx`):
- Nueva sección "Oferta": selector tipo (Fijo/Porcentaje), input valor, dos date pickers (inicio/fin), preview del precio resultante.
- Validación: si `type=percent` → 0 < valor ≤ 100; si `fixed` → valor < precio base; `end > start`.

**Frontend público**:
- `ProductCard` y `ProductDetailPage`: precio original tachado + precio oferta destacado + badge "-XX%" cuando aplique.
- Catálogo: mismo badge en la card.

---

### 2. Modificador de precio en variantes

Hoy `product_variants.price_override` es un precio absoluto. Añadimos:
- `price_modifier` numeric (signed, default 0) — delta aplicado sobre `base_price` (p.ej. +20, -5).
- Se mantiene `price_override` por retrocompatibilidad; si está informado tiene prioridad. Si no, `final = base_price + price_modifier`.

**Admin variantes**: nuevo campo "Modificador de precio (±€)" en la tabla de variantes con tooltip explicativo.

**Frontend**: `getEffectivePrice` recalcula al cambiar variante seleccionada y refresca el bloque de precio + oferta.

---

### 3. Productos destacados

**Base de datos**:
- `products.is_featured` boolean default false
- `products.featured_order` integer (orden global, nullable)

**Admin** — nueva ruta `/admin/productes/destacats`:
- Listado drag-and-drop (usando `@dnd-kit` que ya está en el proyecto si está disponible; si no, instalarlo) que persiste `featured_order`.
- Buscador para añadir productos a destacados (toggle `is_featured`).
- Entrada en el menú lateral debajo de "Productes".
- Toggle ⭐ también disponible en `AdminProductForm` y en la lista general de productos.

**Frontend** (`HomePage`):
- Nuevo componente `FeaturedProductsSection` insertado entre el Hero y los 3 bloques centrales.
- Grid responsive reusando `ProductCard`. Si no hay destacados, no renderiza nada (no rompe la home).

---

### 4. Productos relacionados (upsell)

**Base de datos** — nueva tabla:

```
product_relations(
  product_id uuid → products,
  related_product_id uuid → products,
  position int,
  PRIMARY KEY (product_id, related_product_id)
)
```
Con GRANTs estándar + RLS (admin gestiona, anon/auth lee).

**Admin** (`AdminProductForm.tsx`):
- Sección "Productes relacionats" al final del formulario: buscador con autocompletado de productos + lista reordenable (drag-and-drop) + botón eliminar.

**Frontend ficha de producto**:
- Nueva sección `RelatedProducts` al final de `ProductDetailPage`, debajo de la descripción larga. Grid de cards (reusa `ProductCard`).

---

### 5. Pop-up upsell al añadir al carrito

**Cart context / hook** (`CartContext.tsx`):
- Tras `addItem(product)` exitoso, si el producto tiene relacionados y hay al menos uno con stock, emite evento (`upsellRequested`).

**Componente nuevo** `UpsellDialog.tsx`:
- Montado globalmente en `App.tsx`.
- Escucha el evento, hace fetch de los relacionados (con precio efectivo §1/§2 y stock).
- Modal con cards compactas: imagen, nombre, precio, botones "Afegir al carret" y "Veure fitxa" (navega a `/producte/[slug]` y cierra).
- Si no hay relacionados con stock, no abre (silencioso).
- Se puede desactivar por el usuario en sesión ("No tornar a mostrar en aquest carret") — opcional, recomendado.

---

### Compatibilidad y no-regresiones

- `base_price` y `price_override` siguen funcionando; el helper de precio centraliza la lógica para no duplicar cálculos en checkout, listas, plantillas ni órdenes.
- Checkout y order_items siguen guardando `unit_price` final calculado, igual que ahora (sin cambios en `order_items_stock_trigger` ni en RLS).
- Las listas de nacimiento y plantillas siguen usando `getEffectiveStock`; añadimos lectura del precio efectivo solo a nivel de UI (no se persiste).
- i18n: badges "Oferta", "Destacat", títulos de secciones y diálogo upsell → `ui_translations` (ca/es).
- Sin cambios en políticas RLS existentes; las nuevas columnas heredan las policies de `products` / `product_variants`.

---

### Orden de implementación

1. Migración: columnas oferta + featured + `price_modifier` + tabla `product_relations` (un solo migration).
2. Helper `pricing.ts` + tests manuales.
3. Admin: form de producto (oferta, destacado, modificador en variantes, relacionados).
4. Admin: pantalla "Destacats" con drag-and-drop.
5. Frontend público: precio en card/ficha, sección Featured en home, sección Related en ficha.
6. Upsell dialog global + integración con carrito.
7. Traducciones UI ca/es.