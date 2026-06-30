import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProductCard from '../ProductCard';
import type { TranslatedProduct } from '@/hooks/useTranslatedProducts';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, fb?: string) => fb ?? k }),
}));

const addStandardItem = vi.fn();
const requestUpsell = vi.fn();
vi.mock('@/contexts/CartContext', () => ({
  useCart: () => ({ addStandardItem, requestUpsell }),
}));

const baseProduct = (overrides: Partial<TranslatedProduct> = {}): TranslatedProduct => ({
  id: 'p1',
  slug: 'producte-test',
  sku: 'SKU1',
  basePrice: 10,
  priceWithTax: 12.1,
  finalPriceWithTax: 12.1,
  taxPercentage: 21,
  taxName: 'IVA',
  onSale: false,
  discountPct: 0,
  salePriceType: null,
  saleValue: null,
  saleStartsAt: null,
  saleEndsAt: null,
  isFeatured: false,
  featuredOrder: null,
  stockQuantity: 0,
  stockStatus: 'out_of_stock',
  isActive: true,
  hasVariants: false,
  weightGrams: 0,
  categoryId: null,
  brandId: null,
  brandName: null,
  brandLogo: null,
  name: 'Producte Test',
  shortDescription: null,
  description: '',
  primaryImage: null,
  createdAt: new Date().toISOString(),
  replacement: null,
  ...overrides,
});

const renderCard = (product: TranslatedProduct, view: 'grid' | 'list' = 'grid') =>
  render(
    <MemoryRouter>
      <ProductCard product={product} view={view} />
    </MemoryRouter>,
  );

describe('ProductCard — add-to-cart disabled when stock=0 & on_order', () => {
  it('grid view: disables the add-to-cart button', () => {
    // After normalisation in useTranslatedProducts, stock=0 + on_order -> out_of_stock.
    const p = baseProduct({ stockQuantity: 0, stockStatus: 'out_of_stock' });
    renderCard(p, 'grid');
    const buttons = screen.getAllByRole('button');
    // Grid view renders a single icon button.
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((b) => expect(b).toBeDisabled());
  });

  it('list view: disables the add-to-cart button', () => {
    const p = baseProduct({ stockQuantity: 0, stockStatus: 'out_of_stock' });
    renderCard(p, 'list');
    const btn = screen.getByRole('button', { name: /products\.addToCart|Add to cart|Afegir/i });
    expect(btn).toBeDisabled();
  });

  it('in_stock products keep the button enabled', () => {
    const p = baseProduct({ stockQuantity: 5, stockStatus: 'in_stock' });
    renderCard(p, 'list');
    const btn = screen.getByRole('button', { name: /products\.addToCart|Add to cart|Afegir/i });
    expect(btn).not.toBeDisabled();
  });
});
