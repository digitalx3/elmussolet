import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ShoppingBag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useCart } from '@/contexts/CartContext';
import type { TranslatedProduct } from '@/hooks/useTranslatedProducts';

interface Props {
  product: TranslatedProduct;
  view: 'grid' | 'list';
}

const stockBadge = (status: string, quantity: number, t: (k: string) => string) => {
  switch (status) {
    case 'in_stock':
      if (quantity === 1) {
        return <Badge variant="secondary" className="bg-last-unit text-last-unit-foreground">{t('products.lastUnit')}</Badge>;
      }
      return <Badge variant="secondary" className="bg-sage text-sage-foreground">{t('products.inStock')}</Badge>;
    case 'on_order':
      return <Badge variant="secondary" className="bg-warm text-warm-foreground">{t('products.onOrder')}</Badge>;
    case 'out_of_stock':
      return <Badge variant="destructive">{t('products.outOfStock')}</Badge>;
    default:
      return null;
  }
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(price);

const PriceBlock: React.FC<{ product: TranslatedProduct; size?: 'sm' | 'md' }> = ({ product, size = 'md' }) => {
  if (product.onSale) {
    return (
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className={size === 'sm' ? 'text-xs text-muted-foreground line-through' : 'text-sm text-muted-foreground line-through'}>
          {formatPrice(product.priceWithTax)}
        </span>
        <span className={size === 'sm' ? 'font-display text-base font-bold text-primary' : 'font-display text-lg font-bold text-primary'}>
          {formatPrice(product.finalPriceWithTax)}
        </span>
      </div>
    );
  }
  return (
    <span className={size === 'sm' ? 'font-display text-base font-bold text-foreground' : 'font-display text-lg font-bold text-foreground'}>
      {formatPrice(product.finalPriceWithTax)}
    </span>
  );
};

const ProductCard: React.FC<Props> = ({ product, view }) => {
  const { t } = useTranslation();
  const { addStandardItem } = useCart();

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (product.stockStatus === 'out_of_stock') return;
    addStandardItem({
      productId: product.id,
      name: product.name,
      image: product.primaryImage ?? undefined,
      price: product.finalPriceWithTax,
      basePriceNoTax: product.basePrice,
      taxPercentage: product.taxPercentage ?? 0,
      quantity: 1,
    });
  };

  if (view === 'list') {
    return (
      <Link
        to={`/producte/${product.slug}`}
        className="flex gap-4 rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-card group"
      >
        <div className="h-28 w-28 flex-shrink-0 overflow-hidden rounded-md bg-muted">
          {product.primaryImage ? (
            <img src={product.primaryImage} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">
              {t('products.noResults')}
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col justify-between min-w-0">
          <div>
            {product.brandName && (
              <p className="text-xs font-medium text-muted-foreground mb-0.5">{product.brandName}</p>
            )}
            <h3 className="font-display text-base font-semibold text-card-foreground truncate group-hover:text-primary transition-colors">
              {product.name}
            </h3>
            {product.shortDescription && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{product.shortDescription}</p>
            )}
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <PriceBlock product={product} />
              {stockBadge(product.stockStatus, product.stockQuantity, t)}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={handleAddToCart}
              disabled={product.stockStatus === 'out_of_stock'}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              {t('products.addToCart')}
            </Button>
          </div>
        </div>
      </Link>
    );
  }

  // Grid view
  return (
    <Link
      to={`/producte/${product.slug}`}
      className="group flex flex-col rounded-lg border border-border bg-card overflow-hidden transition-shadow hover:shadow-card"
    >
      <div className="aspect-square overflow-hidden bg-muted relative">
        {product.primaryImage ? (
          <img
            src={product.primaryImage}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground text-sm">
            <ShoppingBag className="h-8 w-8" />
          </div>
        )}
        <div className="absolute top-2 right-2">
          {stockBadge(product.stockStatus, product.stockQuantity, t)}
        </div>
        {product.onSale && product.discountPct > 0 && (
          <div className="absolute top-2 left-2">
            <Badge variant="destructive">-{product.discountPct}%</Badge>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        {product.brandName && (
          <p className="text-xs font-medium text-muted-foreground">{product.brandName}</p>
        )}
        <h3 className="font-display text-sm font-semibold text-card-foreground mt-0.5 line-clamp-2 group-hover:text-primary transition-colors">
          {product.name}
        </h3>
        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <PriceBlock product={product} size="sm" />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 flex-shrink-0"
            onClick={handleAddToCart}
            disabled={product.stockStatus === 'out_of_stock'}
          >
            <ShoppingBag className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
