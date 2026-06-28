import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Flame, ShoppingBag } from 'lucide-react';
import { useSaleProducts } from '@/hooks/useTranslatedProducts';
import { formatPriceEUR } from '@/lib/pricing';
import { Button } from '@/components/ui/button';

const PAGE_SIZE = 8;

const SaleProducts: React.FC = () => {
  const { t } = useTranslation();
  const { data: products = [], isLoading } = useSaleProducts(32);
  const [page, setPage] = useState(0);

  const pages = useMemo(() => {
    const out: typeof products[] = [];
    for (let i = 0; i < products.length; i += PAGE_SIZE) {
      out.push(products.slice(i, i + PAGE_SIZE));
    }
    return out;
  }, [products]);

  if (isLoading || products.length === 0) return null;

  const safePage = Math.min(page, pages.length - 1);
  const current = pages[safePage] ?? [];
  const hasMultiplePages = pages.length > 1;

  return (
    <section className="py-10 md:py-14 bg-destructive/5">
      <div className="container">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-destructive" />
            <h2 className="font-display text-2xl md:text-3xl font-bold text-destructive">
              {t('home.onSale', 'Productes en oferta')}
            </h2>
          </div>
          {hasMultiplePages && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => (p - 1 + pages.length) % pages.length)}
                aria-label={t('common.previous', 'Anterior')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                {safePage + 1} / {pages.length}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => (p + 1) % pages.length)}
                aria-label={t('common.next', 'Següent')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {current.map((p) => (
            <Link
              key={p.id}
              to={`/producte/${p.slug}`}
              className="group relative flex flex-col rounded-lg border-2 border-destructive/30 bg-card overflow-hidden transition-shadow hover:shadow-card hover:border-destructive/60"
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
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-destructive px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-destructive-foreground shadow">
                  <Flame className="h-3 w-3" />
                  {t('home.saleLabel', 'Oferta')} -{p.discountPct}%
                </span>
              </div>
              <div className="p-3 flex-1 flex flex-col">
                {p.brandName && <p className="text-xs text-muted-foreground">{p.brandName}</p>}
                <h3 className="font-display text-sm font-semibold line-clamp-2 group-hover:text-destructive transition-colors">
                  {p.name}
                </h3>
                <div className="mt-auto pt-2 flex items-baseline gap-2">
                  <span className="text-xs text-muted-foreground line-through">
                    {formatPriceEUR(p.priceWithTax)}
                  </span>
                  <span className="font-display text-base font-bold text-destructive">
                    {formatPriceEUR(p.finalPriceWithTax)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SaleProducts;
