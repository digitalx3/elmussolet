import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------- Mocks ----------
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, fb?: string) => (typeof fb === 'string' ? fb : k),
    i18n: { language: 'ca' },
  }),
}));

const notifySuccess = vi.fn();
const notifyError = vi.fn();
vi.mock('@/lib/notify', () => ({
  notify: {
    success: (...args: any[]) => notifySuccess(...args),
    error: (...args: any[]) => notifyError(...args),
    info: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Supabase client mock with chainable update/delete on table 'products' (and noop on others)
let updateResult: { error: any } = { error: null };
let deleteResult: { error: any } = { error: null };
const updateSpy = vi.fn();
const deleteSpy = vi.fn();

vi.mock('@/integrations/supabase/client', () => {
  const productsChain = {
    update: (payload: any) => {
      updateSpy(payload);
      return { eq: (_c: string, _v: string) => Promise.resolve(updateResult) };
    },
    delete: () => {
      deleteSpy('products');
      return { eq: (_c: string, _v: string) => Promise.resolve(deleteResult) };
    },
  };
  const childChain = {
    delete: () => ({ eq: (_c: string, _v: string) => Promise.resolve({ error: null }) }),
  };
  return {
    supabase: {
      from: (table: string) => (table === 'products' ? productsChain : childChain),
    },
  };
});

// Mock hooks providing data
const activeProduct = {
  id: 'p-active',
  slug: 'actiu',
  sku: 'SKU-A',
  base_price: 10,
  stock_quantity: 5,
  stock_status: 'in_stock',
  is_active: true,
  category_id: null,
  default_section_id: null,
  brands: null,
  product_images: [],
  product_variants: [],
  product_translations: [{ language: 'ca', name: 'Producte Actiu' }],
};
const inactiveProduct = {
  ...activeProduct,
  id: 'p-inactive',
  slug: 'inactiu',
  sku: 'SKU-I',
  is_active: false,
  product_translations: [{ language: 'ca', name: 'Producte Arxivat' }],
};

vi.mock('@/hooks/useAdminProducts', async () => {
  const actual = await vi.importActual<any>('@/hooks/useAdminProducts');
  return {
    ...actual,
    useAdminProducts: () => ({ data: [activeProduct, inactiveProduct], isLoading: false }),
  };
});

vi.mock('@/hooks/useCategories', () => ({
  useCategories: () => ({ data: [] }),
}));

vi.mock('@/hooks/useDefaultListSections', () => ({
  useDefaultListSections: () => ({ data: [] }),
  pickSectionName: (s: any) => s?.name ?? '',
}));

import AdminProductList from '../AdminProductList';

const renderPage = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <AdminProductList />
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

const findRow = (name: string) => {
  const link = screen.getByRole('link', { name });
  // climb to <tr>
  let el: HTMLElement | null = link;
  while (el && el.tagName !== 'TR') el = el.parentElement as HTMLElement | null;
  if (!el) throw new Error('Row not found');
  return el;
};

beforeEach(() => {
  updateResult = { error: null };
  deleteResult = { error: null };
  updateSpy.mockClear();
  deleteSpy.mockClear();
  notifySuccess.mockClear();
  notifyError.mockClear();
});

describe('AdminProductList — archive / restore / delete UX', () => {
  it('asks for confirmation before archiving and shows a success toast', async () => {
    const user = userEvent.setup();
    renderPage();

    const row = findRow('Producte Actiu');
    await user.click(within(row).getByTitle('Arxivar (desactivar)'));

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText(/Arxivar "Producte Actiu"\?/)).toBeInTheDocument();
    expect(screen.getByText(/deixarà d'aparèixer al catàleg públic/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Arxivar' }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith({ is_active: false }));
    await waitFor(() => expect(notifySuccess).toHaveBeenCalled());
    expect(notifySuccess.mock.calls[0][0]).toBe('Producte arxivat');
    expect(notifySuccess.mock.calls[0][1]?.description).toMatch(/historial/i);
  });

  it('asks for confirmation before restoring an archived product', async () => {
    const user = userEvent.setup();
    renderPage();

    const row = findRow('Producte Arxivat');
    await user.click(within(row).getByTitle('Restaurar (activar)'));

    expect(await screen.findByText(/Restaurar "Producte Arxivat"\?/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restaurar' }));

    await waitFor(() => expect(updateSpy).toHaveBeenCalledWith({ is_active: true }));
    await waitFor(() => expect(notifySuccess).toHaveBeenCalled());
    expect(notifySuccess.mock.calls[0][0]).toBe('Producte restaurat');
  });

  it('shows an error toast when the archive request fails', async () => {
    const user = userEvent.setup();
    updateResult = { error: { message: 'boom-archive' } };
    renderPage();

    const row = findRow('Producte Actiu');
    await user.click(within(row).getByTitle('Arxivar (desactivar)'));
    await user.click(await screen.findByRole('button', { name: 'Arxivar' }));

    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(notifyError.mock.calls[0][0]).toBe("No s'ha pogut actualitzar l'estat");
    expect(notifyError.mock.calls[0][1]?.description).toBe('boom-archive');
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it('warns about history preservation and confirms permanent delete', async () => {
    const user = userEvent.setup();
    renderPage();

    const row = findRow('Producte Actiu');
    await user.click(within(row).getByTitle('Eliminar definitivament'));

    expect(await screen.findByText(/Eliminar definitivament "Producte Actiu"\?/)).toBeInTheDocument();
    expect(screen.getByText(/historial de comandes es manté intacte/i)).toBeInTheDocument();
    expect(screen.getByText(/Arxivar/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Eliminar definitivament' }));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledWith('products'));
    await waitFor(() => expect(notifySuccess).toHaveBeenCalled());
    expect(notifySuccess.mock.calls[0][0]).toBe('Producte eliminat definitivament');
    expect(notifySuccess.mock.calls[0][1]?.description).toMatch(/historial de comandes/i);
  });

  it('shows an error toast when permanent delete fails', async () => {
    const user = userEvent.setup();
    deleteResult = { error: { message: 'boom-delete' } };
    renderPage();

    const row = findRow('Producte Actiu');
    await user.click(within(row).getByTitle('Eliminar definitivament'));
    await user.click(await screen.findByRole('button', { name: 'Eliminar definitivament' }));

    await waitFor(() => expect(notifyError).toHaveBeenCalled());
    expect(notifyError.mock.calls[0][0]).toBe("No s'ha pogut eliminar el producte");
    expect(notifyError.mock.calls[0][1]?.description).toBe('boom-delete');
  });

  it('does not mutate when the user cancels the archive dialog', async () => {
    const user = userEvent.setup();
    renderPage();

    const row = findRow('Producte Actiu');
    await user.click(within(row).getByTitle('Arxivar (desactivar)'));
    await user.click(await screen.findByRole('button', { name: 'common.cancel' }));

    expect(updateSpy).not.toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
  });
});
