/**
 * Helpers to flatten/unflatten nested i18n JSON objects to key/value pairs.
 * "products.cart.title" <-> { products: { cart: { title: "..." } } }
 */
export type FlatTranslations = Record<string, string>;

export function flattenTranslations(obj: unknown, prefix = ''): FlatTranslations {
  const out: FlatTranslations = {};
  if (obj == null || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flattenTranslations(v, key));
    } else if (typeof v === 'string') {
      out[key] = v;
    } else if (Array.isArray(v)) {
      out[key] = JSON.stringify(v);
    } else if (v != null) {
      out[key] = String(v);
    }
  }
  return out;
}

export function unflattenTranslations(flat: FlatTranslations): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let cur: Record<string, unknown> = out;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {};
      cur = cur[p] as Record<string, unknown>;
    }
    cur[parts[parts.length - 1]] = value;
  }
  return out;
}
