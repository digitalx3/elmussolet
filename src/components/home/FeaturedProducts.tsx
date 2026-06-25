import React from 'react';
import { Link } from 'react-router-dom';
import { useFeaturedProducts } from '@/hooks/useTranslatedProducts';
import { formatPriceEUR } from '@/lib/pricing';
import { Badge } from '@/components/ui/badge';
import { Star, ShoppingBag } from 'lucide-react';

const FeaturedProducts: React.FC = () => {
  const { data: products = [], isLoading } = useFeaturedProducts(8);

  if (isLoading || products.length === 0) return null;

  return (
    <section className="py-10 md:py-14 bg-background">
      <div className="container">
        <div className="flex items-center gap-2 mb-6">
          <Star className="h-5 w-5 text-primary fill-primary" />
          <h2 className="font-display text-2xl md:text-3xl font-bold">Productes destacats</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {products.map(p => (
            <Link
              key={p.id}
              to={`/producte/${p.slug}`}
              className="group flex flex-col rounded-lg border border-border bg-card overflow-hidden transition-shadow hover:shadow-card"
            >
              <div className="aspect-square overflow-hidden bg-muted relative">
                {p.primaryImage ? (
                  <img
                    src={p.primaryImage}
                    alt={p.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ShoppingBag className="h-8 w-8" />
                  </div>
                )}
                {p.onSale && (
                  <Badge variant="destructive" className="absolute top-2 left-2">-{p.discountPct}%</Badge>
                )}
              </div>
              <div className="p-3 flex-1 flex flex-col">
                {p.brandName && <p className="text-xs text-muted-foreground">{p.brandName}</p>}
                <h3 className="font-display text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors">{p.name}</h3>
                <div className="mt-auto pt-2 flex items-baseline gap-2">
                  {p.onSale ? (
                    <>
                      <span className="text-xs text-muted-foreground line-through">{formatPriceEUR(p.priceWithTax)}</span>
                      <span className="font-display text-base font-bold text-primary">{formatPriceEUR(p.finalPriceWithTax)}</span>
                    </>
                  ) : (
                    <span className="font-display text-base font-bold text-foreground">{formatPriceEUR(p.finalPriceWithTax)}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;
