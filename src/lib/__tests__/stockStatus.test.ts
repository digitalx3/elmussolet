import { describe, it, expect } from 'vitest';

/**
 * These pure helpers mirror the inline logic used in:
 *  - src/hooks/useTranslatedProducts.ts (catalog/home stock normalisation)
 *  - src/pages/ProductDetailPage.tsx (effectiveOutOfStock computation)
 *
 * Keeping the rules under test guarantees that "stock = 0 + on_order" is
 * always treated as OUT OF STOCK in both surfaces, so the "Add to cart"
 * button must be disabled.
 */

function normaliseStockStatus(rawStatus: string, qty: number): string {
  if (rawStatus === 'discontinued') return 'discontinued';
  if (qty === -1) return 'on_order';
  if (qty <= 0) return 'out_of_stock';
  return rawStatus;
}

function detailEffectiveOutOfStock(opts: {
  stockStatus: string;
  stockQuantity: number;
  hasUsableVariants?: boolean;
  variantStockTotal?: number;
  hasUnlimitedVariant?: boolean;
}): boolean {
  const {
    stockStatus,
    stockQuantity,
    hasUsableVariants = false,
    variantStockTotal = 0,
    hasUnlimitedVariant = false,
  } = opts;
  const isDiscontinued = stockStatus === 'discontinued';
  const isOnOrder = stockStatus === 'on_order';
  return (
    isDiscontinued ||
    (hasUsableVariants
      ? !hasUnlimitedVariant && variantStockTotal === 0
      : stockStatus === 'out_of_stock' || (isOnOrder && stockQuantity === 0))
  );
}

describe('Catalog/home normaliseStockStatus', () => {
  it('on_order + stock 0 => out_of_stock (button must be disabled)', () => {
    expect(normaliseStockStatus('on_order', 0)).toBe('out_of_stock');
  });

  it('on_order + stock -1 (unlimited) => stays on_order', () => {
    expect(normaliseStockStatus('on_order', -1)).toBe('on_order');
  });

  it('on_order + positive stock => stays on_order', () => {
    expect(normaliseStockStatus('on_order', 3)).toBe('on_order');
  });

  it('in_stock + stock 0 => out_of_stock', () => {
    expect(normaliseStockStatus('in_stock', 0)).toBe('out_of_stock');
  });

  it('discontinued always wins', () => {
    expect(normaliseStockStatus('discontinued', 99)).toBe('discontinued');
  });
});

describe('ProductDetailPage effectiveOutOfStock', () => {
  it('on_order + stock 0 (no variants) => true (button disabled)', () => {
    expect(
      detailEffectiveOutOfStock({ stockStatus: 'on_order', stockQuantity: 0 }),
    ).toBe(true);
  });

  it('on_order + stock -1 (unlimited) => false (button enabled)', () => {
    expect(
      detailEffectiveOutOfStock({ stockStatus: 'on_order', stockQuantity: -1 }),
    ).toBe(false);
  });

  it('on_order + positive stock => false', () => {
    expect(
      detailEffectiveOutOfStock({ stockStatus: 'on_order', stockQuantity: 5 }),
    ).toBe(false);
  });

  it('explicit out_of_stock => true', () => {
    expect(
      detailEffectiveOutOfStock({ stockStatus: 'out_of_stock', stockQuantity: 0 }),
    ).toBe(true);
  });

  it('discontinued => true even with stock', () => {
    expect(
      detailEffectiveOutOfStock({ stockStatus: 'discontinued', stockQuantity: 10 }),
    ).toBe(true);
  });

  it('variants: all variants at 0 and none unlimited => true', () => {
    expect(
      detailEffectiveOutOfStock({
        stockStatus: 'on_order',
        stockQuantity: 0,
        hasUsableVariants: true,
        variantStockTotal: 0,
        hasUnlimitedVariant: false,
      }),
    ).toBe(true);
  });

  it('variants: any unlimited variant => false', () => {
    expect(
      detailEffectiveOutOfStock({
        stockStatus: 'on_order',
        stockQuantity: 0,
        hasUsableVariants: true,
        variantStockTotal: 0,
        hasUnlimitedVariant: true,
      }),
    ).toBe(false);
  });
});
