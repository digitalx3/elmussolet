export const DEFAULT_HERO_OVERRIDES_KEY = 'default_hero_overrides';
export const DEFAULT_HERO_OVERRIDES_KEY_2 = 'default_hero_overrides_2';
export const HERO_VARIANT_KEYS = [DEFAULT_HERO_OVERRIDES_KEY, DEFAULT_HERO_OVERRIDES_KEY_2] as const;
export const HERO_ROTATION_MS = 10000;

/** Per-language editable text fields of the default hero. */
export type HeroLanguageContent = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  button1_text?: string;
  button2_text?: string;
  card_title?: string;
  card_subtitle?: string;
};

/** Editable content fields of the default hero (fixed layout). */
export type DefaultHeroOverrides = {
  /** When true, this variant is included in the rotation. Defaults to true for variant 1. */
  enabled?: boolean;
  // Left block - legacy CA/ES fields (kept for backward compatibility).
  eyebrow_ca?: string;
  eyebrow_es?: string;
  title_ca?: string;
  title_es?: string;
  subtitle_ca?: string;
  subtitle_es?: string;
  button1_text_ca?: string;
  button1_text_es?: string;
  button1_url?: string;
  button2_text_ca?: string;
  button2_text_es?: string;
  button2_url?: string;

  /** Dynamic per-language translations keyed by language code (e.g. 'ca', 'es', 'en'). */
  translations?: Record<string, HeroLanguageContent>;

  // Text sizes (px). Per-variant overrides. 0 / undefined = use default styles.
  eyebrow_size?: number;
  title_size?: number;
  subtitle_size?: number;
  button1_size?: number;
  button2_size?: number;
  card_title_size?: number;
  card_subtitle_size?: number;

  // Right block - image
  image_url?: string | null;
  image_aspect?: '1/1' | '4/5' | '4/3' | '3/4' | '16/9';
  image_radius?: number; // px
  image_object_fit?: 'cover' | 'contain';
  image_max_width?: number; // px

  // Right block - small floating card (bottom-left of image)
  card_visible?: boolean;
  card_logo_url?: string | null;
  card_title_ca?: string;
  card_title_es?: string;
  card_subtitle_ca?: string;
  card_subtitle_es?: string;
};

/** Resolve a text field for a given language with sensible fallbacks. */
export function pickHeroText(
  o: DefaultHeroOverrides | undefined,
  field: keyof HeroLanguageContent,
  lang: string,
): string {
  if (!o) return '';
  const t = o.translations?.[lang]?.[field];
  if (t && t.trim()) return t;
  // Legacy fields
  const legacyKey = (field === 'eyebrow' || field === 'title' || field === 'subtitle')
    ? `${field}_${lang}` as keyof DefaultHeroOverrides
    : field === 'button1_text' ? `button1_text_${lang}` as keyof DefaultHeroOverrides
    : field === 'button2_text' ? `button2_text_${lang}` as keyof DefaultHeroOverrides
    : field === 'card_title' ? `card_title_${lang}` as keyof DefaultHeroOverrides
    : field === 'card_subtitle' ? `card_subtitle_${lang}` as keyof DefaultHeroOverrides
    : undefined;
  if (legacyKey) {
    const v = o[legacyKey] as string | undefined;
    if (v && v.trim()) return v;
  }
  // Final fallback: other language translations
  const trs = o.translations ?? {};
  for (const code of Object.keys(trs)) {
    const v = trs[code]?.[field];
    if (v && v.trim()) return v;
  }
  // Legacy ca/es fallback
  const caLegacy = (o as any)[`${field}_ca`] as string | undefined;
  if (caLegacy?.trim()) return caLegacy;
  const esLegacy = (o as any)[`${field}_es`] as string | undefined;
  if (esLegacy?.trim()) return esLegacy;
  return '';
}

export const DEFAULT_HERO: Required<Omit<DefaultHeroOverrides,
  'image_url' | 'card_logo_url'>> & { image_url: string | null; card_logo_url: string | null } = {
  enabled: true,
  eyebrow_ca: 'Puericultura amb cor',
  eyebrow_es: 'Puericultura con corazón',
  title_ca: 'La teva botiga de puericultura de confiança',
  title_es: 'Tu tienda de puericultura de confianza',
  subtitle_ca: 'Tot el que necessites per al teu nadó, amb la qualitat i la proximitat que mereixes.',
  subtitle_es: 'Todo lo que necesitas para tu bebé, con la calidad y la proximidad que mereces.',
  button1_text_ca: 'Explora el catàleg',
  button1_text_es: 'Explora el catálogo',
  button1_url: '/cataleg',
  button2_text_ca: 'Accedir a una llista',
  button2_text_es: 'Acceder a una lista',
  button2_url: '/llista-naixement',

  eyebrow_size: 0,
  title_size: 0,
  subtitle_size: 0,
  button1_size: 0,
  button2_size: 0,
  card_title_size: 0,
  card_subtitle_size: 0,

  image_url: null,
  image_aspect: '4/5',
  image_radius: 24,
  image_object_fit: 'cover',
  image_max_width: 560,

  card_visible: true,
  card_logo_url: null,
  card_title_ca: 'El Mussolet',
  card_title_es: 'El Mussolet',
  card_subtitle_ca: 'Botiga de confiança',
  card_subtitle_es: 'Tienda de confianza',
};

export function mergeHeroOverrides(overrides?: DefaultHeroOverrides | null) {
  const o = overrides ?? {};
  const merged = { ...DEFAULT_HERO };
  (Object.keys(o) as (keyof DefaultHeroOverrides)[]).forEach((k) => {
    const v = o[k];
    if (v === undefined) return;
    if (k === 'image_url' || k === 'card_logo_url') {
      (merged as Record<string, unknown>)[k] = v ?? null;
      return;
    }
    if (v === null || v === '') return;
    (merged as Record<string, unknown>)[k] = v;
  });
  return merged;
}
