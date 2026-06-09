import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CANVAS_WIDTH, DEFAULT_BOX, Device, ElementBox, Layout } from '@/components/admin/HeroCanvasEditor';

type Slide = {
  id: string;
  background_image_url: string | null;
  background_overlay: number;
  badge_text_ca: string | null; badge_text_es: string | null;
  title_ca: string | null; title_es: string | null;
  subtitle_ca: string | null; subtitle_es: string | null;
  button1_text_ca: string | null; button1_text_es: string | null;
  button1_url: string | null; button1_variant: string | null;
  button2_text_ca: string | null; button2_text_es: string | null;
  button2_url: string | null; button2_variant: string | null;
  layout: Layout;
  canvas_heights: Record<Device, number>;
};

function useDevice(): Device {
  const [d, setD] = useState<Device>(() => {
    if (typeof window === 'undefined') return 'desktop';
    const w = window.innerWidth;
    if (w < 640) return 'mobile';
    if (w < 1024) return 'tablet';
    return 'desktop';
  });
  useEffect(() => {
    const onR = () => {
      const w = window.innerWidth;
      setD(w < 640 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop');
    };
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);
  return d;
}

const HeroSlideView: React.FC<{ slide: Slide; device: Device }> = ({ slide, device }) => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const lang = i18n.language?.startsWith('es') ? 'es' : 'ca';
  const pick = (ca: string | null, es: string | null) => (lang === 'es' ? es || ca : ca || es) ?? '';

  const layout = (slide.layout?.[device] ?? slide.layout?.desktop ?? {}) as Partial<Record<string, ElementBox>>;
  const canvasW = CANVAS_WIDTH[device];
  const canvasH = slide.canvas_heights?.[device] ?? 500;

  const get = (k: keyof typeof DEFAULT_BOX): ElementBox => (layout[k] ?? DEFAULT_BOX[k]);

  const items: Array<{ key: keyof typeof DEFAULT_BOX; node: React.ReactNode; box: ElementBox }> = [];

  const badgeText = pick(slide.badge_text_ca, slide.badge_text_es);
  if (badgeText) {
    const box = get('badge');
    if (box.visible !== false) items.push({
      key: 'badge', box,
      node: <span className="px-3 py-1 rounded-full inline-block" style={{ backgroundColor: box.bgColor }}>{badgeText}</span>,
    });
  }
  const titleText = pick(slide.title_ca, slide.title_es);
  if (titleText) {
    const box = get('title');
    if (box.visible !== false) items.push({
      key: 'title', box,
      node: <h1 className="font-display leading-[1.05] m-0" style={{ fontSize: 'inherit', color: 'inherit' }}>{titleText}</h1>,
    });
  }
  const subtitleText = pick(slide.subtitle_ca, slide.subtitle_es);
  if (subtitleText) {
    const box = get('subtitle');
    if (box.visible !== false) items.push({
      key: 'subtitle', box,
      node: <p className="m-0 leading-snug" style={{ fontSize: 'inherit', color: 'inherit' }}>{subtitleText}</p>,
    });
  }
  const btn1Text = pick(slide.button1_text_ca, slide.button1_text_es);
  if (btn1Text) {
    const box = get('button1');
    if (box.visible !== false) items.push({
      key: 'button1', box,
      node: (
        <Button
          variant={(slide.button1_variant as 'default' | 'outline' | 'secondary' | 'ghost') ?? 'default'}
          className="rounded-full w-full h-full"
          onClick={() => slide.button1_url && navigate(slide.button1_url)}
        >
          {btn1Text}
        </Button>
      ),
    });
  }
  const btn2Text = pick(slide.button2_text_ca, slide.button2_text_es);
  if (btn2Text) {
    const box = get('button2');
    if (box.visible !== false) items.push({
      key: 'button2', box,
      node: (
        <Button
          variant={(slide.button2_variant as 'default' | 'outline' | 'secondary' | 'ghost') ?? 'outline'}
          className="rounded-full w-full h-full"
          onClick={() => slide.button2_url && navigate(slide.button2_url)}
        >
          {btn2Text}
        </Button>
      ),
    });
  }

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        aspectRatio: `${canvasW} / ${canvasH}`,
        backgroundImage: slide.background_image_url ? `url(${slide.background_image_url})` : undefined,
        backgroundColor: slide.background_image_url ? undefined : 'hsl(var(--secondary))',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {slide.background_image_url && slide.background_overlay > 0 && (
        <div className="absolute inset-0 bg-black pointer-events-none" style={{ opacity: slide.background_overlay }} />
      )}
      {/* Absolute layer scaled by container width */}
      <div className="absolute inset-0">
        <div
          className="relative w-full h-full"
          style={{
            // Use container queries via CSS variables: scale = 100% / canvasW
          }}
        >
          {items.map((it) => {
            const leftPct = (it.box.x / canvasW) * 100;
            const topPct = (it.box.y / canvasH) * 100;
            const widthPct = (it.box.w / canvasW) * 100;
            const heightPct = (it.box.h / canvasH) * 100;
            // Scale font size with viewport width (cqw-like via vw fallback)
            const fontSizeStyle = it.box.fontSize ? `clamp(10px, ${(it.box.fontSize / canvasW) * 100}cqw, ${it.box.fontSize * 1.2}px)` : undefined;
            return (
              <div
                key={it.key}
                className="absolute flex items-center"
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  fontSize: fontSizeStyle,
                  color: it.box.color,
                  textAlign: it.box.textAlign,
                  justifyContent:
                    it.box.textAlign === 'center' ? 'center' :
                    it.box.textAlign === 'right' ? 'flex-end' : 'flex-start',
                }}
              >
                <div className="w-full" style={{ textAlign: it.box.textAlign }}>
                  {it.node}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const HeroCarousel: React.FC = () => {
  const device = useDevice();
  const [index, setIndex] = useState(0);

  const { data: slides = [] } = useQuery({
    queryKey: ['hero-slides-public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hero_slides')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Slide[];
    },
  });

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  if (slides.length === 0) return null;

  const current = slides[index % slides.length];

  return (
    <section className="relative" style={{ containerType: 'inline-size' }}>
      <HeroSlideView slide={current} device={device} />

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => setIndex((i) => (i - 1 + slides.length) % slides.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 bg-card/80 hover:bg-card rounded-full p-2 shadow-soft"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % slides.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 bg-card/80 hover:bg-card rounded-full p-2 shadow-soft"
            aria-label="Següent"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all ${i === index ? 'w-8 bg-primary' : 'w-2 bg-card/70'}`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default HeroCarousel;
