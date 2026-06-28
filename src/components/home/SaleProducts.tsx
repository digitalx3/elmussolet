import React, { useId, useMemo, useState } from 'react';
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
  const headingId = useId();

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

  const originalLabel = t('home.originalPrice', 'Preu original');
  const saleLabel = t('home.salePrice', 'Preu en oferta');

  return (
    <section className="py-10 md:py-14 bg-destructive/5" aria-labelledby={headingId}>
      <div className="container">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-destructive" aria-hidden="true" />
            <h2
              id={headingId}
              className="font-display text-2xl md:text-3xl font-bold text-destructive"
            >
              {t('home.onSale', 'Productes en oferta')}
            </h2>
          </div>
          {hasMultiplePages && (
            <div
              className="flex items-center gap-2"
              role="group"
              aria-label={t('home.salePagination', 'Paginació d\'ofertes')}
            >
              <Button
                variant="outline"
                size="icon"
                className="min-h-11 min-w-11 focus-visible:ring-2 focus-visible:ring-destructive"
                onClick={() => setPage((p) => (p - 1 + pages.length) % pages.length)}
                aria-label={t('common.previous', 'Anterior')}
                aria-controls={`${headingId}-grid`}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <span
                className="text-sm text-muted-foreground tabular-nums"
                aria-live="polite"
                aria-atomic="true"
              >
                {safePage + 1} / {pages.length}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="min-h-11 min-w-11 focus-visible:ring-2 focus-visible:ring-destructive"
                onClick={() => setPage((p) => (p + 1) % pages.length)}
                aria-label={t('common.next', 'Següent')}
                aria-controls={`${headingId}-grid`}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>

        <ul
          id={`${headingId}-grid`}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 list-none p-0"
        >
          {current.map((p) => {
            const cardLabel = `${p.name} — ${t('home.saleLabel', 'Oferta')} -${p.discountPct}% · ${saleLabel} ${formatPriceEUR(p.finalPriceWithTax)}`;
            return (
              <li key={p.id}>
                <Link
                  to={`/producte/${p.slug}`}
                  aria-label={cardLabel}
                  className="group relative flex h-full flex-col rounded-lg border-2 border-destructive/30 bg-card overflow-hidden transition-shadow hover:shadow-card hover:border-destructive/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <div className="aspect-square overflow-hidden bg-muted relative">
                    {p.primaryImage ? (
                      <img
                        src={p.primaryImage}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full items-center justify-center text-muted-foreground"
                        aria-hidden="true"
                      >
                        <ShoppingBag className="h-8 w-8" />
                      </div>
                    )}
                    <span
                      className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-destructive px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-destructive-foreground shadow"
                      aria-hidden="true"
                    >
                      <Flame className="h-3 w-3" aria-hidden="true" />
                      {t('home.saleLabel', 'Oferta')} -{p.discountPct}%
                    </span>
                  </div>
                  <div className="p-3 flex-1 flex flex-col">
                    {p.brandName && <p className="text-xs text-muted-foreground">{p.brandName}</p>}
                    <h3 className="font-display text-sm font-semibold line-clamp-2 group-hover:text-destructive transition-colors">
                      {p.name}
                    </h3>
                    <div className="mt-auto pt-2 flex items-baseline gap-2" aria-hidden="true">
                      <s className="text-xs text-muted-foreground">
                        {formatPriceEUR(p.priceWithTax)}
                      </s>
                      <span className="font-display text-base font-bold text-destructive">
                        {formatPriceEUR(p.finalPriceWithTax)}
                      </span>
                    </div>
                    <span className="sr-only">
                      {originalLabel} {formatPriceEUR(p.priceWithTax)}, {saleLabel} {formatPriceEUR(p.finalPriceWithTax)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};

export default SaleProducts;
