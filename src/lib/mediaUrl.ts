/**
 * Helper to resolve media (image/asset) URLs based on site_settings.
 *
 * Strategy:
 * - If the input is already an absolute URL (http(s)://, data:, blob:), return as-is.
 * - Otherwise, prepend the configured media_base_url (trailing slash trimmed).
 * - If no base is configured, return the original path unchanged.
 *
 * Settings are cached in-memory after first load and can be refreshed via `setMediaConfig`.
 */

type MediaConfig = {
  media_base_url?: string;
  assets_base_url?: string;
  site_canonical_url?: string;
  api_base_url?: string;
  storage_provider?: 'supabase' | 'vps';
};

let cachedConfig: MediaConfig = {};

export function setMediaConfig(cfg: Partial<MediaConfig>) {
  cachedConfig = { ...cachedConfig, ...cfg };
}

export function getMediaConfig(): MediaConfig {
  return cachedConfig;
}

function isAbsolute(url: string): boolean {
  return /^(https?:|data:|blob:)/i.test(url);
}

function trimSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

/**
 * Resolve an image / media URL.
 * @param path relative path or absolute URL
 * @param kind 'media' (default, uses media_base_url) or 'asset' (uses assets_base_url)
 */
export function resolveMediaUrl(
  path: string | null | undefined,
  kind: 'media' | 'asset' = 'media',
): string {
  if (!path) return '';
  if (isAbsolute(path)) return path;

  const base =
    kind === 'asset'
      ? cachedConfig.assets_base_url
      : cachedConfig.media_base_url;

  if (!base) return path;

  const cleanBase = trimSlash(base);
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

export function resolveAssetUrl(path: string | null | undefined): string {
  return resolveMediaUrl(path, 'asset');
}

export function getApiBaseUrl(): string {
  return cachedConfig.api_base_url ? trimSlash(cachedConfig.api_base_url) : '';
}

export function getStorageProvider(): 'supabase' | 'vps' {
  return cachedConfig.storage_provider ?? 'supabase';
}
