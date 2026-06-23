import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_HERO_OVERRIDES_KEY,
  DefaultHeroOverrides,
  mergeHeroOverrides,
} from '@/lib/defaultHeroSlide';

interface Props {
  /** Optional override data for live preview (admin). When omitted, reads from DB. */
  preview?: DefaultHeroOverrides;
}

const DefaultHero: React.FC<Props> = ({ preview }) => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith('es') ? 'es' : 'ca';

  const { data: dbOverrides } = useQuery({
    queryKey: ['default-hero-overrides-public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', DEFAULT_HERO_OVERRIDES_KEY)
        .maybeSingle();
      if (error) throw error;
      if (!data?.value) return null;
      try { return JSON.parse(data.value as unknown as string) as DefaultHeroOverrides; }
      catch { return null; }
    },
    enabled: !preview,
  });

  const h = mergeHeroOverrides(preview ?? dbOverrides ?? undefined);
  const pick = (ca: string, es: string) => (lang === 'es' ? es || ca : ca || es);

  const eyebrow = pick(h.eyebrow_ca, h.eyebrow_es);
  const title = pick(h.title_ca, h.title_es);
  const subtitle = pick(h.subtitle_ca, h.subtitle_es);
  const b1 = pick(h.button1_text_ca, h.button1_text_es);
  const b2 = pick(h.button2_text_ca, h.button2_text_es);
  const cardTitle = pick(h.card_title_ca, h.card_title_es);
  const cardSubtitle = pick(h.card_subtitle_ca, h.card_subtitle_es);

  return (
    <section className="bg-background">
      <div className="container mx-auto px-4 py-12 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-12 items-center">
          {/* LEFT BLOCK */}
          <div className="space-y-5 md:space-y-6">
            {eyebrow && (
              <span className="inline-block px-4 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium">
                {eyebrow}
              </span>
            )}
            {title && (
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] text-foreground">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed">
                {subtitle}
              </p>
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              {b1 && (
                <Button
                  size="lg"
                  className="rounded-full px-7"
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
                      <div className="font-display font-semibold text-sm text-foreground truncate">
                        {cardTitle}
                      </div>
                    )}
                    {cardSubtitle && (
                      <div className="text-xs text-muted-foreground truncate">
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
