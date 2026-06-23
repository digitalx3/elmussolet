import { defaultLayout } from '@/components/admin/HeroCanvasEditor';

export const DEFAULT_HERO_NAME = 'Hero per defecte';
export const DEFAULT_HERO_OVERRIDES_KEY = 'default_hero_overrides';

/** Editable content fields of the default hero. Structure/layout never changes. */
export type DefaultHeroOverrides = {
  background_image_url?: string | null;
  background_overlay?: number;
  badge_text_ca?: string;
  badge_text_es?: string;
  title_ca?: string;
  title_es?: string;
  subtitle_ca?: string;
  subtitle_es?: string;
  button1_text_ca?: string;
  button1_text_es?: string;
  button1_url?: string;
  button1_variant?: string;
  button2_text_ca?: string;
  button2_text_es?: string;
  button2_url?: string;
  button2_variant?: string;
};

/** Base template (structure + default content). Structure is fixed. */
export function baseDefaultHeroSlide() {
  return {
    name: DEFAULT_HERO_NAME,
    is_active: true,
    background_image_url: null as string | null,
    background_overlay: 0.15,
    badge_text_ca: 'Puericultura amb cor',
    badge_text_es: 'Puericultura con corazón',
    title_ca: 'La teva botiga de puericultura de confiança',
    title_es: 'Tu tienda de puericultura de confianza',
    subtitle_ca: 'Tot el que necessites per al teu nadó, amb la qualitat i la proximitat que mereixes',
    subtitle_es: 'Todo lo que necesitas para tu bebé, con la calidad y la proximidad que mereces',
    button1_text_ca: 'Explora el catàleg',
    button1_text_es: 'Explora el catálogo',
    button1_url: '/cataleg',
    button1_variant: 'default',
    button2_text_ca: 'Accedir a una llista',
    button2_text_es: 'Acceder a una lista',
    button2_url: '/llista-naixement',
    button2_variant: 'outline',
    layout: defaultLayout(),
    canvas_heights: { desktop: 600, tablet: 520, mobile: 560 },
    floating_images: [] as unknown[],
    sort_order: 0,
  };
}

/** Build the default slide, merging only allowed content overrides. */
export function createDefaultHeroSlide(
  overrides: DefaultHeroOverrides & Record<string, unknown> = {},
) {
  const base = baseDefaultHeroSlide();
  const allowed: (keyof DefaultHeroOverrides)[] = [
    'background_image_url',
    'background_overlay',
    'badge_text_ca', 'badge_text_es',
    'title_ca', 'title_es',
    'subtitle_ca', 'subtitle_es',
    'button1_text_ca', 'button1_text_es', 'button1_url', 'button1_variant',
    'button2_text_ca', 'button2_text_es', 'button2_url', 'button2_variant',
  ];
  const merged: Record<string, unknown> = { ...base };
  for (const k of allowed) {
    const v = (overrides as Record<string, unknown>)[k];
    if (v !== undefined && v !== null && v !== '') merged[k] = v;
    else if (k === 'background_image_url' && 'background_image_url' in overrides) {
      // explicit null allowed (image removed)
      merged[k] = v ?? null;
    }
  }
  // allow caller to override non-content fields like id / is_active for the fallback render
  for (const k of Object.keys(overrides)) {
    if (!(allowed as string[]).includes(k)) merged[k] = (overrides as Record<string, unknown>)[k];
  }
  return merged;
}
