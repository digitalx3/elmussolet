import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DefaultHeroOverrides,
  HERO_ROTATION_MS,
  HERO_VARIANT_KEYS,
  mergeHeroOverrides,
  pickHeroText,
} from '@/lib/defaultHeroSlide';

interface Props {
  /** Optional override data for live preview (admin). When omitted, reads from DB. */
  preview?: DefaultHeroOverrides;
}

const DefaultHero: React.FC<Props> = ({ preview }) => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'ca').split('-')[0];

  const { data: dbVariants } = useQuery({
    queryKey: ['default-hero-variants-public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', HERO_VARIANT_KEYS as unknown as string[]);
      if (error) throw error;
      const map = new Map<string, DefaultHeroOverrides>();
      (data ?? []).forEach((row) => {
        try {
          map.set(row.key, JSON.parse(row.value as unknown as string) as DefaultHeroOverrides);
        } catch { /* ignore */ }
      });
      return HERO_VARIANT_KEYS.map((k, i) => {
        const v = map.get(k);
        if (!v) return i === 0 ? {} : null; // variant 1 always shows fallback
        if (v.enabled === false) return null;
        return v;
      });
    },
    enabled: !preview,
  });

  // Active variants for rotation
  const variants: DefaultHeroOverrides[] = preview
    ? [preview]
    : ((dbVariants ?? [{}]).filter((v): v is DefaultHeroOverrides => v !== null));
  const safeVariants = variants.length > 0 ? variants : [{}];

  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (safeVariants.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % safeVariants.length);
    }, HERO_ROTATION_MS);
    return () => window.clearInterval(id);
  }, [safeVariants.length]);

  const current = safeVariants[Math.min(index, safeVariants.length - 1)];
  const h = mergeHeroOverrides(current);

  const eyebrow = pickHeroText(current, 'eyebrow', lang);
  const title = pickHeroText(current, 'title', lang);
  const subtitle = pickHeroText(current, 'subtitle', lang);
  const b1 = pickHeroText(current, 'button1_text', lang);
  const b2 = pickHeroText(current, 'button2_text', lang);
  const cardTitle = pickHeroText(current, 'card_title', lang);
  const cardSubtitle = pickHeroText(current, 'card_subtitle', lang);

  const sizeStyle = (px?: number) => (px && px > 0 ? { fontSize: `${px}px`, lineHeight: 1.2 } : undefined);
  const btnPadStyle = (px?: number) =>
    px && px > 0 ? { fontSize: `${px}px`, lineHeight: 1.2, height: 'auto', paddingTop: `${Math.round(px * 0.6)}px`, paddingBottom: `${Math.round(px * 0.6)}px` } : undefined;

  return (
    <section className="bg-background">
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12 items-center">
          {/* LEFT BLOCK */}
          <div className="space-y-5 md:space-y-6">
            {eyebrow && (
              <span
                className="inline-block px-4 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium"
                style={sizeStyle(h.eyebrow_size)}
              >
                {eyebrow}
              </span>
            )}
            {title && (
              <h1
                className={`font-display font-bold leading-[1.1] text-foreground ${h.title_size > 0 ? '' : 'text-4xl md:text-5xl lg:text-6xl'}`}
                style={sizeStyle(h.title_size)}
              >
                {title}
              </h1>
            )}
            {subtitle && (
              <p
                className={`text-muted-foreground max-w-xl leading-relaxed ${h.subtitle_size > 0 ? '' : 'text-base md:text-lg'}`}
                style={sizeStyle(h.subtitle_size)}
              >
                {subtitle}
              </p>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              {b1 && (
                <Button
                  size="lg"
                  className="rounded-full px-7"
                  style={btnPadStyle(h.button1_size)}
                  onClick={() => h.button1_url && navigate(h.button1_url)}
                >
                  {b1}
                </Button>
              )}
              {b2 && (
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full px-7"
                  style={btnPadStyle(h.button2_size)}
                  onClick={() => h.button2_url && navigate(h.button2_url)}
                >
                  {b2}
                </Button>
              )}
            </div>
          </div>

          {/* RIGHT BLOCK */}
          <div className="relative w-full flex justify-center md:justify-end">
            <div
              className="relative w-full"
              style={{ maxWidth: `${h.image_max_width}px` }}
            >
              <div
                className="relative w-full overflow-hidden bg-muted shadow-soft"
                style={{
                  aspectRatio: h.image_aspect.replace('/', ' / '),
                  borderRadius: `${h.image_radius}px`,
                }}
              >
                {h.image_url ? (
                  <img
                    src={h.image_url}
                    alt=""
                    className="w-full h-full"
                    style={{ objectFit: h.image_object_fit }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                    Sense imatge
                  </div>
                )}
              </div>

              {h.card_visible && (cardTitle || cardSubtitle || h.card_logo_url) && (
                <div className="absolute -bottom-5 -left-5 md:-bottom-6 md:-left-6 bg-card border border-border rounded-2xl shadow-soft px-4 py-3 flex items-center gap-3 max-w-[78%]">
                  {h.card_logo_url && (
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                      <img src={h.card_logo_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="min-w-0">
                    {cardTitle && (
                      <div
                        className={`font-display font-semibold text-foreground truncate ${h.card_title_size > 0 ? '' : 'text-sm'}`}
                        style={sizeStyle(h.card_title_size)}
                      >
                        {cardTitle}
                      </div>
                    )}
                    {cardSubtitle && (
                      <div
                        className={`text-muted-foreground truncate ${h.card_subtitle_size > 0 ? '' : 'text-xs'}`}
                        style={sizeStyle(h.card_subtitle_size)}
                      >
                        {cardSubtitle}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DefaultHero;
