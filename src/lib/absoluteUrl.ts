/**
 * Ensure a URL is absolute and publicly accessible.
 * - Absolute http(s) URLs are returned untouched.
 * - data:/blob: URLs are rejected (not crawlable) → returns empty string.
 * - Relative paths are prefixed with the configured public origin.
 */
const PUBLIC_ORIGIN = 'https://elmussolet.com';

export function toAbsoluteUrl(
  url: string | null | undefined,
  origin: string = PUBLIC_ORIGIN,
): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  if (/^(data:|blob:)/i.test(url)) return '';
  const base = origin.replace(/\/+$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

export const PUBLIC_SITE_ORIGIN = PUBLIC_ORIGIN;
