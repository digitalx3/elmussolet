import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Package, Store, Heart, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import heroImage from '@/assets/hero-baby.jpg';

const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={heroImage} alt="El Mussolet" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-foreground/70 via-foreground/40 to-transparent" />
        </div>
        <div className="container relative z-10 py-24 md:py-36">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-xl"
          >
            <h1 className="font-display text-4xl md:text-5xl font-bold text-primary-foreground leading-tight mb-4">
              {t('home.heroTitle')}
            </h1>
            <p className="text-lg text-primary-foreground/80 mb-8 leading-relaxed">
              {t('home.heroSubtitle')}
            </p>
            <Button
              size="lg"
              onClick={() => navigate('/cataleg')}
              className="gap-2"
            >
              {t('home.exploreCatalog')}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Birth List CTA */}
      <section className="bg-sage py-16">
        <div className="container text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Heart className="h-10 w-10 text-primary mx-auto mb-4" />
            <h2 className="font-display text-3xl font-bold text-sage-foreground mb-3">
              {t('home.birthListTitle')}
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto mb-8 leading-relaxed">
              {t('home.birthListDesc')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => navigate(user ? '/la-meva-llista' : '/registre')}
                className="gap-2"
              >
                {t('home.createList')}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/llista-naixement')}
                className="gap-2"
              >
                {t('home.accessList')}
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trust signals */}
      <section className="py-16">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Package, title: t('home.secureShipping'), desc: 'Enviament ràpid i segur a tota la península.' },
              { icon: Store, title: t('home.storePickup'), desc: 'Recull la teva comanda a la botiga sense cost.' },
              { icon: Heart, title: t('home.personalAttention'), desc: 'T\'assessorem personalment per triar el millor.' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="text-center p-6 rounded-lg bg-card shadow-soft"
              >
                <item.icon className="h-8 w-8 text-primary mx-auto mb-3" />
                <h3 className="font-display text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
