import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Sparkles, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import HeroCarousel from '@/components/home/HeroCarousel';
import HomeBlocks from '@/components/home/HomeBlocks';
import heroImage from '@/assets/hero-mussolet.jpg';
import logoSquare from '@/assets/mussolet-logo-square.png.asset.json';

const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: hasCustomHeros } = useQuery({
    queryKey: ['hero-slides-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('hero_slides')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true);
      return (count ?? 0) > 0;
    },
  });

  return (
    <div className="bg-background">
      {hasCustomHeros ? (
        <HeroCarousel />
      ) : (
      <section className="relative overflow-hidden bg-gradient-to-br from-secondary via-background to-cream">
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <div className="absolute -top-20 -right-20 h-96 w-96 rounded-full bg-accent/40 blur-3xl" />
          <div className="absolute bottom-0 -left-20 h-80 w-80 rounded-full bg-primary/20 blur-3xl" />
        </div>
        <div className="container relative z-10 grid md:grid-cols-2 gap-10 items-center py-16 md:py-24">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-4 py-1.5 text-xs font-semibold text-primary mb-5 shadow-soft">
              <Sparkles className="h-3.5 w-3.5" /> Puericultura amb cor
            </span>
            <h1 className="font-display text-5xl md:text-7xl font-normal text-foreground leading-[1.05] mb-5">
              {t('home.heroTitle')}
            </h1>
            <p className="text-base md:text-lg text-muted-foreground mb-8 leading-relaxed max-w-md">
              {t('home.heroSubtitle')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" onClick={() => navigate('/cataleg')} className="gap-2 rounded-full px-7">
                {t('home.exploreCatalog')}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/llista-naixement')} className="gap-2 rounded-full px-7 border-primary/30">
                <Gift className="h-4 w-4" />
                {t('home.accessList')}
              </Button>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.7, delay: 0.1 }} className="relative">
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-elevated border-4 border-card">
              <img src={heroImage} alt="El Mussolet" className="h-full w-full object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-6 hidden md:flex items-center gap-3 bg-card rounded-2xl px-5 py-3 shadow-elevated border border-border">
              <img src={logoSquare.url} alt="" className="h-12 w-12" />
              <div>
                <div className="font-display text-xl leading-none text-primary">Solsona</div>
                <div className="text-xs text-muted-foreground">Lleida · Catalunya</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
      )}

      <HomeBlocks />
    </div>
  );
};

export default HomePage;

