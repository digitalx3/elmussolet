import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';

// Mocks ---------------------------------------------------------------------
const invokeMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...a: any[]) => invokeMock(...a) } },
}));

vi.mock('@/hooks/useLanguages', () => ({
  useLanguages: () => ({
    data: [
      { code: 'ca', native_name: 'Català' },
      { code: 'es', native_name: 'Español' },
    ],
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k }),
}));

vi.mock('@/lib/notify', () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

import AdminMarketingSeo from '../AdminMarketingSeo';

const renderPage = () =>
  render(
    <HelmetProvider>
      <AdminMarketingSeo />
    </HelmetProvider>,
  );

const FORBIDDEN = [/supabase/i, /storage/i, /lovable/i];

const assertClean = (text: string) => {
  for (const re of FORBIDDEN) {
    expect(re.test(text)).toBe(false);
  }
};

describe('AdminMarketingSeo — no internal infra leaks', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('does not expose supabase/storage/lovable in the initial render', () => {
    const { container } = renderPage();
    assertClean(container.textContent || '');
  });

  it('does not expose internal URLs in the last-regeneration block after regenerate', async () => {
    invokeMock.mockResolvedValue({
      data: {
        ok: true,
        generated_at: new Date().toISOString(),
        regenerated: ['seo/sitemap.xml', 'seo/sitemap-ca.xml', 'seo/robots.txt'],
        robots: 'https://dembqxfdzvwilckastuj.supabase.co/storage/v1/object/public/site-assets/seo/robots.txt',
        sitemapIndex:
          'https://dembqxfdzvwilckastuj.supabase.co/storage/v1/object/public/site-assets/seo/sitemap.xml',
        sitemaps: [
          {
            lang: 'ca',
            url: 'https://dembqxfdzvwilckastuj.supabase.co/storage/v1/object/public/site-assets/seo/sitemap-ca.xml',
          },
        ],
      },
      error: null,
    });

    const { container } = renderPage();
    fireEvent.click(screen.getByRole('button', { name: /Regenerar-ho tot/i }));

    await waitFor(() => {
      expect(screen.getByText(/Última regeneració/i)).toBeInTheDocument();
    });

    // The visible last-regeneration block must list only the file names,
    // never the underlying storage URL or any internal-provider mention.
    assertClean(container.textContent || '');
    expect(screen.getAllByText('sitemap.xml').length).toBeGreaterThan(0);
    expect(screen.getAllByText('robots.txt').length).toBeGreaterThan(0);
  });
});
