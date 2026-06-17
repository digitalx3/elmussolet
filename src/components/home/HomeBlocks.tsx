import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import logoSquare from '@/assets/mussolet-logo-square.png.asset.json';

interface Block {
  id: string;
  slug: string;
  kind: string;
  icon: string | null;
  sort_order: number;
  title_ca: string | null;
  title_es: string | null;
  subtitle_ca: string | null;
  subtitle_es: string | null;
  cta_label_ca: string | null;
  cta_label_es: string | null;
  cta_url: string | null;
  custom_class: string | null;
}

export const HomeBlocks: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const lang = i18n.language === 'es' ? 'es' : 'ca';

  const { data: blocks = [] } = useQuery({
    queryKey: ['home-blocks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cms_blocks')
        .select('*')
        .in('kind', ['home_feature', 'home_cta'])
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return data as Block[];
    },
  });

  const features = blocks.filter(b => b.kind === 'home_feature');
  const ctas = blocks.filter(b => b.kind === 'home_cta');

  const title = (b: Block) => (lang === 'es' ? b.title_es : b.title_ca) ?? '';
  const subtitle = (b: Block) => (lang === 'es' ? b.subtitle_es : b.subtitle_ca) ?? '';
  const ctaLabel = (b: Block) => (lang === 'es' ? b.cta_label_es : b.cta_label_ca) ?? '';

  return (
    <>
      {features.length > 0 && (
        <section className="py-16 md:py-20">
          <div className="container">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {features.map((b, i) => {
                const Icon = (LucideIcons as any)[b.icon || 'Package'] || LucideIcons.Package;
                return (
                  <motion.div
                    key={b.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.1 }}
                    className={`group text-center p-8 rounded-3xl bg-card border border-border shadow-soft hover:shadow-elevated hover:-translate-y-1 transition-all ${b.custom_class ?? ''}`}
                  >
                    <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-secondary text-primary mb-4 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-display text-2xl mb-2 text-foreground">{title(b)}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{subtitle(b)}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {ctas.map(b => (
        <section key={b.id} className="py-16 md:py-20">
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className={`relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary to-[hsl(18_55%_28%)] text-primary-foreground p-10 md:p-16 shadow-elevated ${b.custom_class ?? ''}`}
            >
              <div className="absolute -right-10 -bottom-10 opacity-15">
                <img src={logoSquare.url} alt="" className="h-72 w-72" />
              </div>
              <div className="relative max-w-2xl">
                <LucideIcons.Heart className="h-10 w-10 mb-5 text-accent" />
                <h2 className="font-display text-4xl md:text-5xl mb-4 leading-tight">{title(b)}</h2>
                <p className="text-primary-foreground/85 mb-8 leading-relaxed text-base md:text-lg">{subtitle(b)}</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  {ctaLabel(b) && (
                    <Button
                      size="lg"
                      variant="secondary"
                      onClick={() => navigate(user ? (b.cta_url || '/la-meva-llista') : '/registre')}
                      className="gap-2 rounded-full px-7"
                    >
                      <LucideIcons.Gift className="h-4 w-4" />
                      {ctaLabel(b)}
                    </Button>
                  )}
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
      ))}
    </>
  );
};

export default HomeBlocks;
