import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Store } from 'lucide-react';
import { useBrands } from '@/hooks/useBrands';

const BrandsShowcase: React.FC = () => {
  const { t } = useTranslation();
  const { data: brands = [], isLoading } = useBrands();

  if (isLoading) return null;

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

        {brands.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
            {t('home.brandsEmpty', 'Encara no hi ha marques disponibles.')}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {brands.map((brand) => (
              <Link
                key={brand.id}
                to={`/marca/${brand.slug}`}
                title={brand.name}
                aria-label={brand.name}
                className="group flex aspect-[4/3] items-center justify-center rounded-lg border border-border bg-card p-4 transition-all hover:shadow-card hover:border-primary/40"
              >
                {brand.logoUrl ? (
                  <img
                    src={brand.logoUrl}
                    alt={brand.name}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Store className="h-6 w-6" />
                    <span className="text-xs font-medium text-center line-clamp-2">{brand.name}</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default BrandsShowcase;
