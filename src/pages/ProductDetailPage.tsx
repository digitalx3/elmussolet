import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ShoppingBag, Share2, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useProductBySlug, useRelatedProducts } from '@/hooks/useTranslatedProducts';
import { useCart } from '@/contexts/CartContext';
import { computePrice, formatPriceEUR } from '@/lib/pricing';

const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const giftItemId = searchParams.get('gift');
  const giftListId = searchParams.get('listId');
  const isGiftMode = !!(giftItemId && giftListId);
  const { addStandardItem, addListItem } = useCart();
  const { data: product, isLoading, error } = useProductBySlug(slug);
  const { data: relatedProducts = [] } = useRelatedProducts(product?.id);

  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  const variantGroups = useMemo(() => {
    if (!product?.variants.length) return [];
    const groups: Record<string, { typeName: string; typeSlug: string; variants: typeof product.variants }> = {};
    product.variants.forEach(v => {
      if (!groups[v.typeSlug]) {
        groups[v.typeSlug] = { typeName: v.typeName, typeSlug: v.typeSlug, variants: [] };
      }
      groups[v.typeSlug].variants.push(v);
    });
    return Object.values(groups);
  }, [product]);

  const selectedVariant = product?.variants.find(v => v.id === selectedVariantId);
  const taxPct = product?.taxPercentage ?? 0;

  const pricing = useMemo(() => {
    if (!product) return { base: 0, final: 0, onSale: false, discountPct: 0, savings: 0 };
    return computePrice({
      basePrice: product.basePrice,
      salePriceType: product.salePriceType,
      saleValue: product.saleValue,
      saleStartsAt: product.saleStartsAt,
      saleEndsAt: product.saleEndsAt,
      variantPriceOverride: selectedVariant?.priceOverride ?? null,
      variantPriceModifier: selectedVariant?.priceModifier ?? 0,
    });
  }, [product, selectedVariant]);

  const basePriceWithTax = pricing.base * (1 + taxPct / 100);
  const finalPriceWithTax = pricing.final * (1 + taxPct / 100);

  const variantStockTotal = (product?.variants ?? []).reduce((s, v) => s + (v.stockQuantity ?? 0), 0);
  const hasUsableVariants = !!product?.hasVariants && variantGroups.length > 0;
  const effectiveOutOfStock = hasUsableVariants
    ? variantStockTotal === 0
    : product?.stockStatus === 'out_of_stock';
  const currentStock = selectedVariant
    ? selectedVariant.stockQuantity
    : (hasUsableVariants ? variantStockTotal : (product?.stockQuantity ?? 0));

  const handleAddToCart = () => {
    if (!product) return;
    if (product.hasVariants && variantGroups.length > 0 && !selectedVariantId) {
      toast.error('Selecciona una variant');
      return;
    }
    const payload = {
      productId: product.id,
      variantId: selectedVariantId ?? undefined,
      name: product.name + (selectedVariant ? ` - ${selectedVariant.value}` : ''),
      image: product.images[0]?.image_url,
      price: finalPriceWithTax,
      basePriceNoTax: pricing.final,
      taxPercentage: taxPct,
      quantity,
      variantLabel: selectedVariant?.value,
      ...(isGiftMode && giftItemId ? { listItemId: giftItemId } : {}),
    };
    if (isGiftMode && giftListId) {
      addListItem(payload, giftListId);
      toast.success(t('list.giftAdded') || 'Regal afegit a la cistella');
      navigate('/cistella');
      return;
    }
    addStandardItem(payload);
    toast.success(t('products.addToCart'));
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('URL copiada!');
    } catch {
      toast.error('Error');
    }
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="aspect-square rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container py-16 text-center">
        <p className="text-lg text-foreground mb-4">{t('errors.notFound')}</p>
        <Button variant="outline" onClick={() => navigate('/cataleg')}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          {t('products.catalog')}
        </Button>
      </div>
    );
  }

  const images = product.images.length > 0 ? product.images : [{ image_url: '/placeholder.svg', alt_text: product.name, id: 'placeholder' }];

  // Helper to render variant price label
  const variantPriceLabel = (v: typeof product.variants[number]) => {
    let priceNoTax = product.basePrice;
    if (v.priceOverride != null) priceNoTax = v.priceOverride;
    else if (v.priceModifier) priceNoTax = product.basePrice + v.priceModifier;
    if (priceNoTax === product.basePrice) return null;
    const delta = priceNoTax - product.basePrice;
    const sign = delta > 0 ? '+' : '';
    return ` (${sign}${formatPriceEUR(delta * (1 + taxPct / 100))})`;
  };

  return (
    <div className="container py-6">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/cataleg" className="hover:text-primary">{t('products.catalog')}</Link>
        <span>/</span>
        <span className="text-foreground truncate">{product.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          <div className="aspect-square overflow-hidden rounded-lg bg-muted mb-3 relative">
            <img
              src={images[selectedImageIdx].image_url}
              alt={images[selectedImageIdx].alt_text || product.name}
              className="h-full w-full object-cover"
            />
            {pricing.onSale && (
              <Badge variant="destructive" className="absolute top-3 left-3 text-sm">
                -{pricing.discountPct}%
              </Badge>
            )}
            {images.length > 1 && (
              <>
                <button
                  onClick={() => setSelectedImageIdx(i => (i - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-1.5 shadow hover:bg-background transition-colors"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setSelectedImageIdx(i => (i + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 rounded-full p-1.5 shadow hover:bg-background transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImageIdx(idx)}
                  className={`h-16 w-16 flex-shrink-0 rounded-md overflow-hidden border-2 transition-colors ${idx === selectedImageIdx ? 'border-primary' : 'border-transparent'}`}
                >
                  <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="space-y-4"
        >
          {product.brandName && (
            <p className="text-sm font-medium text-muted-foreground">{product.brandName}</p>
          )}
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground">
            {product.name}
          </h1>

          <div className="flex items-baseline gap-3 flex-wrap">
            {pricing.onSale ? (
              <>
                <span className="font-display text-2xl font-bold text-primary">
                  {formatPriceEUR(finalPriceWithTax)}
                </span>
                <span className="text-lg text-muted-foreground line-through">
                  {formatPriceEUR(basePriceWithTax)}
                </span>
                <Badge variant="destructive">-{pricing.discountPct}%</Badge>
              </>
            ) : (
              <span className="font-display text-2xl font-bold text-primary">
                {formatPriceEUR(finalPriceWithTax)}
              </span>
            )}
            {product.taxName && (
              <span className="text-xs text-muted-foreground">({product.taxName} {product.taxPercentage}% inclòs)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!effectiveOutOfStock && currentStock === 1 && (
              <Badge variant="secondary" className="bg-last-unit text-last-unit-foreground">{t('products.lastUnit')}</Badge>
            )}
            {!effectiveOutOfStock && currentStock !== 1 && product.stockStatus !== 'on_order' && (
              <Badge variant="secondary" className="bg-sage text-sage-foreground">{t('products.inStock')}</Badge>
            )}
            {!effectiveOutOfStock && product.stockStatus === 'on_order' && (
              <Badge variant="secondary" className="bg-warm text-warm-foreground">{t('products.onOrder')}</Badge>
            )}
            {effectiveOutOfStock && (
              <Badge variant="destructive">{t('products.outOfStock')}</Badge>
            )}
          </div>

          {product.shortDescription && (
            <div
              className="prose prose-sm max-w-none text-muted-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ __html: product.shortDescription }}
            />
          )}

          <Separator />

          {variantGroups.map(group => (
            <div key={group.typeSlug}>
              <p className="text-sm font-semibold mb-2">{group.typeName}</p>
              <div className="flex flex-wrap gap-2">
                {group.variants.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariantId(v.id === selectedVariantId ? null : v.id)}
                    className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                      v.id === selectedVariantId
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-foreground hover:border-primary/50'
                    } ${v.stockQuantity === 0 ? 'opacity-40 line-through' : ''}`}
                    disabled={v.stockQuantity === 0}
                  >
                    {v.value}
                    {variantPriceLabel(v) && <span className="ml-1 text-xs">{variantPriceLabel(v)}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="flex items-center gap-3 pt-2">
            <div className="flex items-center border border-border rounded-md">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="p-2 hover:bg-muted transition-colors">
                <Minus className="h-4 w-4" />
              </button>
              <span className="px-4 text-sm font-medium min-w-[2rem] text-center">{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)} className="p-2 hover:bg-muted transition-colors">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <Button
              size="lg"
              className="flex-1 gap-2"
              onClick={handleAddToCart}
              disabled={effectiveOutOfStock || (selectedVariant ? selectedVariant.stockQuantity === 0 : false)}
            >
              <ShoppingBag className="h-4 w-4" />
              {t('products.addToCart')}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1" onClick={handleShare}>
              <Share2 className="h-4 w-4" />
              {t('products.share')}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
        </motion.div>
      </div>

      {product.description && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-10 lg:mt-14"
        >
          <Separator className="mb-6" />
          <h2 className="font-display text-xl md:text-2xl font-semibold mb-4">Descripció</h2>
          <div
            className="prose prose-sm md:prose-base max-w-none text-foreground"
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
        </motion.section>
      )}

      {relatedProducts.length > 0 && (
        <section className="mt-12 lg:mt-16">
          <Separator className="mb-6" />
          <h2 className="font-display text-xl md:text-2xl font-semibold mb-4">També et podria interessar</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {relatedProducts.map(rp => (
              <Link
                key={rp.id}
                to={`/producte/${rp.slug}`}
                className="group flex flex-col rounded-lg border border-border bg-card overflow-hidden transition-shadow hover:shadow-card"
              >
                <div className="aspect-square overflow-hidden bg-muted relative">
                  {rp.primaryImage ? (
                    <img src={rp.primaryImage} alt={rp.name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground"><ShoppingBag className="h-8 w-8" /></div>
                  )}
                  {rp.onSale && <Badge variant="destructive" className="absolute top-2 left-2">-{rp.discountPct}%</Badge>}
                </div>
                <div className="p-3 flex-1 flex flex-col">
                  {rp.brandName && <p className="text-xs text-muted-foreground">{rp.brandName}</p>}
                  <h3 className="font-display text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors">{rp.name}</h3>
                  <div className="mt-auto pt-2 flex items-baseline gap-2">
                    {rp.onSale ? (
                      <>
                        <span className="text-xs text-muted-foreground line-through">{formatPriceEUR(rp.priceWithTax)}</span>
                        <span className="font-display text-base font-bold text-primary">{formatPriceEUR(rp.finalPriceWithTax)}</span>
                      </>
                    ) : (
                      <span className="font-display text-base font-bold text-foreground">{formatPriceEUR(rp.finalPriceWithTax)}</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ProductDetailPage;
