export const DEFAULT_HERO_OVERRIDES_KEY = 'default_hero_overrides';

/** Editable content fields of the default hero (fixed layout). */
export type DefaultHeroOverrides = {
  // Left block
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

export const DEFAULT_HERO: Required<Omit<DefaultHeroOverrides,
  'image_url' | 'card_logo_url'>> & { image_url: string | null; card_logo_url: string | null } = {
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
