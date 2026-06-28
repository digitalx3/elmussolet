import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  brandName: 'Marca X',
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
  window.dispatchEvent(new Event('resize'));
};

const renderComp = () =>
  render(
    <MemoryRouter>
      <SaleProducts />
    </MemoryRouter>,
  );

describe('SaleProducts — accessibility', () => {
  beforeEach(() => {
    useSaleProductsMock.mockReturnValue({
      data: Array.from({ length: 10 }, (_, i) => makeProduct(i)),
      isLoading: false,
    });
  });

  describe.each([
    ['mobile', 375],
    ['desktop', 1440],
  ])('viewport: %s (%ipx)', (_, width) => {
    beforeEach(() => setViewport(width));

    it('exposes the section via aria-labelledby with a heading', () => {
      const { container } = renderComp();
      const section = container.querySelector('section[aria-labelledby]') as HTMLElement;
      expect(section).not.toBeNull();
      const id = section.getAttribute('aria-labelledby')!;
      const heading = document.getElementById(id);
      expect(heading?.tagName).toBe('H2');
      expect(heading?.textContent).toMatch(/Productes en oferta/i);
    });

    it('uses a semantic list (ul/li) for the product grid', () => {
      const { container } = renderComp();
      const list = container.querySelector('ul');
      expect(list).not.toBeNull();
      expect(list!.querySelectorAll(':scope > li').length).toBe(8);
    });

    it('renders the pagination as a labelled group with prev/next having accessible names and aria-controls', () => {
      renderComp();
      const group = screen.getByRole('group', { name: /Paginació/i });
      expect(group).toBeInTheDocument();

      const prev = screen.getByRole('button', { name: /Anterior/i });
      const next = screen.getByRole('button', { name: /Següent/i });
      expect(prev.getAttribute('aria-controls')).toBeTruthy();
      expect(next.getAttribute('aria-controls')).toBe(prev.getAttribute('aria-controls'));

      // Tap target sized for mobile (≥44px hint via min-h/min-w-11).
      expect(prev.className).toMatch(/min-h-11/);
      expect(prev.className).toMatch(/min-w-11/);
      expect(next.className).toMatch(/min-h-11/);
      expect(next.className).toMatch(/min-w-11/);

      // Focus-visible indicator present.
      expect(prev.className).toMatch(/focus-visible:ring/);
      expect(next.className).toMatch(/focus-visible:ring/);
    });

    it('announces page changes via an aria-live region and updates on next/prev', () => {
      renderComp();
      const live = screen.getByText('1 / 2');
      expect(live.getAttribute('aria-live')).toBe('polite');
      fireEvent.click(screen.getByRole('button', { name: /Següent/i }));
      expect(screen.getByText('2 / 2').getAttribute('aria-live')).toBe('polite');
    });

    it('every card link has a descriptive aria-label including name, discount and sale price', () => {
      renderComp();
      const links = screen.getAllByRole('link');
      expect(links.length).toBe(8);
      links.forEach((link) => {
        const label = link.getAttribute('aria-label') || '';
        expect(label).toMatch(/Producte \d+/);
        expect(label).toMatch(/-25%/);
        expect(label).toMatch(/75,00/);
      });
    });

    it('card links expose a visible focus indicator', () => {
      renderComp();
      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        expect(link.className).toMatch(/focus-visible:ring/);
      });
    });

    it('card links are reachable via keyboard tab order (no tabIndex=-1, no positive tabIndex)', () => {
      renderComp();
      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        const ti = link.getAttribute('tabindex');
        if (ti !== null) {
          const n = Number(ti);
          expect(n).toBeLessThanOrEqual(0);
        }
      });
    });

    it('decorative icons and the visual sale badge are hidden from assistive tech', () => {
      const { container } = renderComp();
      const badge = container.querySelector('span.bg-destructive');
      expect(badge?.getAttribute('aria-hidden')).toBe('true');
      // Lucide icons inside the section: all marked aria-hidden.
      const svgs = container.querySelectorAll('svg');
      expect(svgs.length).toBeGreaterThan(0);
      svgs.forEach((svg) => {
        // svgs without explicit aria-hidden should at least be inside an aria-hidden ancestor.
        const hidden =
          svg.getAttribute('aria-hidden') === 'true' ||
          !!svg.closest('[aria-hidden="true"]');
        expect(hidden).toBe(true);
      });
    });

    it('exposes an sr-only sentence with original and sale price for screen readers', () => {
      const { container } = renderComp();
      const srOnly = container.querySelectorAll('.sr-only');
      expect(srOnly.length).toBeGreaterThan(0);
      expect(srOnly[0].textContent).toMatch(/Preu original.*100,00.*Preu en oferta.*75,00/);
    });
  });
});
