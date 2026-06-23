import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Device } from '@/components/admin/HeroCanvasEditor';
import HeroSlideView, { Slide } from '@/components/home/HeroSlideView';
import { createDefaultHeroSlide } from '@/lib/defaultHeroSlide';

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


const HeroCarousel: React.FC = () => {
  const device = useDevice();
  const [index, setIndex] = useState(0);

  const { data: dbSlides, isLoading } = useQuery({
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

  const activeSlides = dbSlides ?? [];
  const slides = activeSlides.length > 0
    ? activeSlides
    : (!isLoading ? [createDefaultHeroSlide({ id: 'fallback-default-hero' }) as unknown as Slide] : []);

  useEffect(() => {
    if (slides.length <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  useEffect(() => {
    setIndex(0);
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
