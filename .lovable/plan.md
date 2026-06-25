# Auditoría y cierre del bloque "Ofertas + Destacados + Relacionados + Upsell"

## Estado actual (verificado en código y BBDD)

| # | Requisito | Estado |
|---|-----------|--------|
| 1 | Campos `sale_price_type`, `sale_value`, `sale_starts_at`, `sale_ends_at` en `products` | OK (BBDD + form admin) |
| 2 | UI admin de oferta (tipo, valor, fechas) en ficha de producto | OK |
| 3 | Cálculo de precio efectivo (`src/lib/pricing.ts`: `computePrice`, `isSaleActive`) | OK |
| 4 | Ficha de producto muestra precio original tachado + final + % descuento | OK |
| 5 | `ProductCard` muestra tachado + final + badge `-X%` | OK |
| 6 | `price_modifier` en `product_variants` + UI admin | OK |
| 7 | Recalculo de precio al elegir variante (en `ProductDetailPage`) | OK |
| 8 | Campo `is_featured` + `featured_order` + toggle en ficha | OK |
| 9 | Página admin `/admin/productes-destacats` con drag&drop (`@dnd-kit`) y entrada de menú | OK |
| 10 | Módulo `FeaturedProducts` en home, entre `DefaultHero` y `HomeBlocks`, oculto si vacío | OK |
| 11 | Tabla `product_relations` + editor de relacionados en ficha admin | OK |
| 12 | Sección "Productes relacionats" al final de la ficha pública | OK |
| 13 | `UpsellDialog` montado globalmente en `App.tsx` y `upsellTrigger` en `CartContext` | OK (montado) |
| 14 | **Disparo real del pop-up al añadir al carrito** | **FALTA** — `requestUpsell` no se llama desde `ProductCard.handleAddToCart` ni desde `ProductDetailPage.handleAddToCart`, así que el diálogo no se abre nunca |
| 15 | Validaciones de oferta (fechas, % 0–100, precio fijo < base) | **FALTA** |
| 16 | Evitar precio final negativo si `price_modifier` resta más que el base | **FALTA** (clamp a 0) |
| 17 | No mostrar como destacado/relacionado productos con `is_active = false` | **FALTA** (hay que filtrar en `useFeaturedProducts` y `useRelatedProducts`) |
| 18 | Evitar auto-relación (producto consigo mismo) | Por confirmar en `RelatedProductsEditor` (se reforzará) |

Todo lo marcado **OK** se queda como está; sólo se tocan los huecos.

## Cambios a aplicar

### 1. Disparar el upsell tras añadir al carrito
- `src/components/catalog/ProductCard.tsx`: tras `addStandardItem(...)`, llamar `requestUpsell(product.id)`.
- `src/pages/ProductDetailPage.tsx`: tras `addStandardItem(payload)` (rama no-regalo), llamar `requestUpsell(product.id)`. No disparar en modo lista de regalo para no interrumpir ese flujo.
- `UpsellDialog` ya se auto-cierra si no hay relacionados con stock, así que no aparece ruido cuando el producto no tiene relacionados.

### 2. Validaciones de oferta en `AdminProductForm.tsx`
Antes de `handleSubmit`:
- Si `sale_price_type` está activo y falta `sale_value` → error inline.
- Si `sale_starts_at` y `sale_ends_at` y `start > end` → error.
- Si `sale_price_type = 'percent'` y `sale_value <= 0 || >= 100` → error.
- Si `sale_price_type = 'fixed'` y `sale_value >= base_price` → error ("el preu d'oferta ha de ser inferior al preu base").
- Si `sale_price_type = 'fixed'` y `sale_value <= 0` → error.
Mostrar mensajes en el bloque "Preu en oferta" y bloquear `saveProduct`.

### 3. Clamp del precio final a 0
- `src/lib/pricing.ts`: al final de `computePrice` aplicar `final = Math.max(0, final)` y `base = Math.max(0, base)` para que un `price_modifier` negativo excesivo no genere importes negativos en carrito/pedido.

### 4. Filtrar productos inactivos en destacados y relacionados
- `src/hooks/useTranslatedProducts.ts`:
  - `useFeaturedProducts`: añadir `.eq('is_active', true)` y ordenar por `featured_order` (ya existente; sólo añadir el filtro si falta).
  - `useRelatedProducts`: filtrar relaciones cuyo `related_product.is_active = false` (descarte en cliente tras el join, o `.eq` en el join filter).

### 5. Reforzar "no auto-relación" en `RelatedProductsEditor.tsx`
- Excluir el propio `productId` de los resultados del buscador y del estado guardado (defensivo, por si quedara alguno antiguo).

## Detalles técnicos

- No se tocan tablas ni RLS: schema ya cubre todo (`product_relations` con `product_id`+`related_product_id`+`position`; `products` con campos de oferta/destacado; `product_variants` con `price_modifier`).
- Carrito/pedidos: el precio que se guarda ya es `finalPriceWithTax` calculado con `computePrice`, así que aplicar el clamp en `pricing.ts` se propaga automáticamente sin tocar `CartContext` ni checkout.
- El pop-up sigue siendo no bloqueante: `UpsellDialog` no se abre si no hay relacionados con stock, y permite cerrar sin añadir nada.
- Sin cambios en i18n; los textos nuevos de validación van en catalán siguiendo el patrón existente del formulario.

## Archivos afectados

- `src/components/catalog/ProductCard.tsx` — disparo de upsell.
- `src/pages/ProductDetailPage.tsx` — disparo de upsell (rama estándar).
- `src/pages/admin/AdminProductForm.tsx` — bloque de validaciones de oferta.
- `src/lib/pricing.ts` — clamp a 0.
- `src/hooks/useTranslatedProducts.ts` — filtrar `is_active` en destacados y relacionados.
- `src/components/admin/RelatedProductsEditor.tsx` — excluir auto-relación.

## Riesgos

- Mínimos: cambios localizados, sin migraciones, sin tocar checkout. El único cambio de comportamiento visible nuevo es la apertura del pop-up cuando un producto tiene relacionados con stock.
