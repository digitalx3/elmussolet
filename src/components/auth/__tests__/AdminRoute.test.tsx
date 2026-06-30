import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AdminRoute } from '../ProtectedRoute';

const mockAuth = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuth(),
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

const mockRpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));

const renderAt = (path = '/admin') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <div>Admin content</div>
            </AdminRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );

describe('AdminRoute (403 for non-admins)', () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockRpc.mockReset();
  });

  it('shows 403 "Accés denegat" when the user is not admin (client check)', async () => {
    mockAuth.mockReturnValue({
      user: { id: 'user-1' },
      isAdmin: false,
      isLoading: false,
    });
    mockRpc.mockResolvedValue({ data: false, error: null });

    renderAt();

    expect(await screen.findByText('403')).toBeInTheDocument();
    expect(screen.getByText('Accés denegat')).toBeInTheDocument();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });

  it('shows 403 when client claims admin but server denies', async () => {
    mockAuth.mockReturnValue({
      user: { id: 'user-2' },
      isAdmin: true,
      isLoading: false,
    });
    mockRpc.mockResolvedValue({ data: false, error: null });

    renderAt();

    await waitFor(() => {
      expect(screen.getByText('403')).toBeInTheDocument();
    });
    expect(
      screen.getByText("El servidor ha denegat l'accés a aquesta secció.")
    ).toBeInTheDocument();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });

  it('renders admin content when both client and server confirm admin', async () => {
    mockAuth.mockReturnValue({
      user: { id: 'admin-1' },
      isAdmin: true,
      isLoading: false,
    });
    mockRpc.mockResolvedValue({ data: true, error: null });

    renderAt();

    expect(await screen.findByText('Admin content')).toBeInTheDocument();
    expect(screen.queryByText('403')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to /login', () => {
    mockAuth.mockReturnValue({ user: null, isAdmin: false, isLoading: false });

    renderAt();

    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it.each([
    '/admin/productes',
    '/admin/comandes',
    '/admin/usuaris',
    '/admin/configuracio/smtp',
    '/admin/marketing-seo',
  ])('shows 403 for non-admin on nested route %s', async (path) => {
    mockAuth.mockReturnValue({
      user: { id: 'user-x' },
      isAdmin: false,
      isLoading: false,
    });
    mockRpc.mockResolvedValue({ data: false, error: null });

    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route
            path="/admin/*"
            element={
              <AdminRoute>
                <Routes>
                  <Route path="productes" element={<div>Productes admin</div>} />
                  <Route path="comandes" element={<div>Comandes admin</div>} />
                  <Route path="usuaris" element={<div>Usuaris admin</div>} />
                  <Route path="configuracio/smtp" element={<div>SMTP admin</div>} />
                  <Route path="marketing-seo" element={<div>Marketing admin</div>} />
                </Routes>
              </AdminRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('403')).toBeInTheDocument();
    expect(screen.getByText('Accés denegat')).toBeInTheDocument();
    expect(screen.queryByText(/admin$/i)).not.toBeInTheDocument();
  });
});
