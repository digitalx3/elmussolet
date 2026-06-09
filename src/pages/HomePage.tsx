import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Package, Store, Heart, ArrowRight, Sparkles, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import HeroCarousel from '@/components/home/HeroCarousel';
import heroImage from '@/assets/hero-mussolet.jpg';
import logoSquare from '@/assets/mussolet-logo-square.png.asset.json';

const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
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
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/llista-naixement')}
                className="gap-2 rounded-full px-7 border-primary/30"
              >
                <Gift className="h-4 w-4" />
                {t('home.accessList')}
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative"
          >
            <div className="relative aspect-[4/3] rounded-3xl overflow-hidden shadow-elevated border-4 border-card">
              <img src={heroImage} alt="El Mussolet" className="h-full w-full object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-6 hidden md:flex items-center gap-3 bg-card rounded-2xl px-5 py-3 shadow-elevated border border-border">
              <img src={logoSquare.url} alt="" className="h-12 w-12" />
              <div>
                <div className="font-display text-xl leading-none text-primary">Berga</div>
                <div className="text-xs text-muted-foreground">Catalunya · Berguedà</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
      )}

      {/* Trust signals */}
      <section className="py-16 md:py-20">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Package, title: t('home.secureShipping'), desc: 'Enviament ràpid i segur a tota la península.' },
              { icon: Store, title: t('home.storePickup'), desc: 'Recull la teva comanda a la botiga sense cost.' },
              { icon: Heart, title: t('home.personalAttention'), desc: "T'assessorem personalment per triar el millor." },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="group text-center p-8 rounded-3xl bg-card border border-border shadow-soft hover:shadow-elevated hover:-translate-y-1 transition-all"
              >
                <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-secondary text-primary mb-4 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="font-display text-2xl mb-2 text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Birth List CTA */}
      <section className="py-16 md:py-20">
        <div className="container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary to-[hsl(18_55%_28%)] text-primary-foreground p-10 md:p-16 shadow-elevated"
          >
            <div className="absolute -right-10 -bottom-10 opacity-15">
              <img src={logoSquare.url} alt="" className="h-72 w-72" />
            </div>
            <div className="relative max-w-2xl">
              <Heart className="h-10 w-10 mb-5 text-accent" />
              <h2 className="font-display text-4xl md:text-5xl mb-4 leading-tight">
                {t('home.birthListTitle')}
              </h2>
              <p className="text-primary-foreground/85 mb-8 leading-relaxed text-base md:text-lg">
                {t('home.birthListDesc')}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => navigate(user ? '/la-meva-llista' : '/registre')}
                  className="gap-2 rounded-full px-7"
                >
                  <Gift className="h-4 w-4" />
                  {t('home.createList')}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate('/llista-naixement')}
                  className="gap-2 rounded-full px-7 bg-transparent border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                >
                  {t('home.accessList')}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
