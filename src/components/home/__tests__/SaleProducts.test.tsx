import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mocks ---------------------------------------------------------------------
const useSaleProductsMock = vi.fn();
vi.mock('@/hooks/useTranslatedProducts', () => ({
  useSaleProducts: (...a: any[]) => useSaleProductsMock(...a),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k }),
}));

import SaleProducts from '../SaleProducts';

const makeProduct = (i: number, overrides: Partial<any> = {}) => ({
  id: `p${i}`,
  slug: `producte-${i}`,
  name: `Producte ${i}`,
  brandName: null,
  primaryImage: null,
  priceWithTax: 100,
  finalPriceWithTax: 80,
  discountPct: 20,
  onSale: true,
  isFeatured: false,
  ...overrides,
});

const renderComp = () =>
  render(
    <MemoryRouter>
      <SaleProducts />
    </MemoryRouter>,
  );

describe('SaleProducts carousel', () => {
  it('returns nothing when there are no sale products', () => {
    useSaleProductsMock.mockReturnValue({ data: [], isLoading: false });
    const { container } = renderComp();
    expect(container.firstChild).toBeNull();
  });

  it('limits the visible page to 8 items even when more are available', () => {
    const products = Array.from({ length: 14 }, (_, i) => makeProduct(i));
    useSaleProductsMock.mockReturnValue({ data: products, isLoading: false });
    renderComp();
    const links = screen.getAllByRole('link');
    expect(links.length).toBe(8);
    // Pagination indicator should appear (2 pages: 8 + 6)
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('hides prev/next controls with a single page (<= 8 items)', () => {
    const products = Array.from({ length: 5 }, (_, i) => makeProduct(i));
    useSaleProductsMock.mockReturnValue({ data: products, isLoading: false });
    renderComp();
    expect(screen.queryByRole('button', { name: /Anterior/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Següent/i })).toBeNull();
  });

  it('cycles pages with next/prev controls and wraps around', () => {
    const products = Array.from({ length: 10 }, (_, i) => makeProduct(i));
    useSaleProductsMock.mockReturnValue({ data: products, isLoading: false });
    renderComp();

    expect(screen.getAllByRole('link').length).toBe(8);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Següent/i }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
    expect(screen.getAllByRole('link').length).toBe(2);

    // wraps forward
    fireEvent.click(screen.getByRole('button', { name: /Següent/i }));
    expect(screen.getByText('1 / 2')).toBeInTheDocument();

    // wraps backward
    fireEvent.click(screen.getByRole('button', { name: /Anterior/i }));
    expect(screen.getByText('2 / 2')).toBeInTheDocument();
  });

  it('renders the sale label with the discount percentage and the struck-through original price', () => {
    useSaleProductsMock.mockReturnValue({
      data: [makeProduct(1, { priceWithTax: 50, finalPriceWithTax: 35, discountPct: 30 })],
      isLoading: false,
    });
    renderComp();
    const card = screen.getByRole('link');
    expect(within(card).getByText(/Oferta -30%/i)).toBeInTheDocument();
    // Original price visible and struck through
    const original = within(card).getByText(/50,00/);
    expect(original.className).toMatch(/line-through/);
  });
});
