import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBrands } from '@/hooks/useBrands';

const BrandsShowcase: React.FC = () => {
  const { t } = useTranslation();
  const { data: brands = [], isLoading } = useBrands();

  const visible = brands.filter((b) => !!b.logoUrl);
  if (isLoading || visible.length === 0) return null;

  return (
    <section className="py-10 md:py-14 bg-background border-t border-border">
      <div className="container">
        <div className="mb-6">
          <h2 className="font-display text-2xl md:text-3xl font-bold">
            {t('home.brands', 'Marques')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('home.brandsSubtitle', 'Fes clic per veure tots els productes del fabricant')}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {visible.map((brand) => (
            <Link
              key={brand.id}
              to={`/cataleg?brand=${brand.id}`}
              title={brand.name}
              aria-label={brand.name}
              className="group flex items-center justify-center rounded-lg border border-border bg-card p-4 h-24 transition-all hover:shadow-card hover:border-primary/40"
            >
              <img
                src={brand.logoUrl!}
                alt={brand.name}
                loading="lazy"
                className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BrandsShowcase;
