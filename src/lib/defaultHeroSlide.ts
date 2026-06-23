import { defaultLayout } from '@/components/admin/HeroCanvasEditor';

export const DEFAULT_HERO_NAME = 'Hero per defecte';

export function createDefaultHeroSlide(overrides: Record<string, unknown> = {}) {
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
    floating_images: [],
    sort_order: 0,
    ...overrides,
  };
}