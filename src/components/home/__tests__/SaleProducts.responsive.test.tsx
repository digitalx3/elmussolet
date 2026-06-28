import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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
  brandName: 'Marca',
  primaryImage: null,
  priceWithTax: 100,
  finalPriceWithTax: 75,
  discountPct: 25,
  onSale: true,
  isFeatured: false,
  ...overrides,
});

const setViewport = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => {
      // Naive parse for `(min-width: NNNpx)`
      const m = /\(min-width:\s*(\d+)px\)/.exec(query);
      const matches = m ? width >= Number(m[1]) : false;
      return {
        matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      } as any;
    },
  });
  window.dispatchEvent(new Event('resize'));
};

const renderComp = () =>
  render(
    <MemoryRouter>
      <SaleProducts />
    </MemoryRouter>,
  );

const assertCardOrder = (card: HTMLElement) => {
  const label = within(card).getByText(/Oferta -25%/i);
  const original = within(card).getByText(/100,00/);
  const final = within(card).getByText(/75,00/);

  // Sale label exists with destructive background and is positioned before prices in DOM.
  expect(label.className).toMatch(/bg-destructive/);
  expect(original.className).toMatch(/line-through/);
  expect(final.className).toMatch(/text-destructive/);

  const pos = (el: HTMLElement) =>
    Array.from(card.querySelectorAll('*')).indexOf(el);
  expect(pos(label)).toBeLessThan(pos(original));
  expect(pos(original)).toBeLessThan(pos(final));
};

describe('SaleProducts — responsive render of label, struck price and sale price', () => {
  beforeEach(() => {
    useSaleProductsMock.mockReturnValue({
      data: [makeProduct(1), makeProduct(2), makeProduct(3)],
      isLoading: false,
    });
  });

  it('renders the label and prices in the correct order on mobile (375px)', () => {
    setViewport(375);
    renderComp();
    const cards = screen.getAllByRole('link');
    expect(cards.length).toBe(3);
    cards.forEach(assertCardOrder);
  });

  it('renders the label and prices in the correct order on desktop (1440px)', () => {
    setViewport(1440);
    renderComp();
    const cards = screen.getAllByRole('link');
    expect(cards.length).toBe(3);
    cards.forEach(assertCardOrder);
  });

  it('uses a responsive grid that scales columns across breakpoints', () => {
    setViewport(1440);
    const { container } = renderComp();
    const grid = container.querySelector('div.grid');
    expect(grid).not.toBeNull();
    // Mobile-first 2 cols, then sm:3, then lg:4
    expect(grid!.className).toMatch(/grid-cols-2/);
    expect(grid!.className).toMatch(/sm:grid-cols-3/);
    expect(grid!.className).toMatch(/lg:grid-cols-4/);
  });
});
