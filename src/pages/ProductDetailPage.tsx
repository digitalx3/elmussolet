import React, { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ShoppingBag, Heart, Share2, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useProductBySlug } from '@/hooks/useTranslatedProducts';
import { useCart } from '@/contexts/CartContext';

const formatPrice = (price: number) =>
  new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(price);

const ProductDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addStandardItem } = useCart();
  const { data: product, isLoading, error } = useProductBySlug(slug);

  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);

  // Group variants by type
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
  const basePrice = selectedVariant?.priceOverride ?? product?.basePrice ?? 0;
  const taxPct = product?.taxPercentage ?? 0;
  const currentPrice = basePrice * (1 + taxPct / 100);
  const currentStock = selectedVariant ? selectedVariant.stockQuantity : (product?.stockQuantity ?? 0);

  const handleAddToCart = () => {
    if (!product) return;
    if (product.hasVariants && !selectedVariantId) {
      toast.error('Selecciona una variant');
      return;
    }
    addStandardItem({
      productId: product.id,
      variantId: selectedVariantId ?? undefined,
      name: product.name + (selectedVariant ? ` - ${selectedVariant.value}` : ''),
      image: product.images[0]?.image_url,
      price: currentPrice,
      quantity,
      variantLabel: selectedVariant?.value,
    });
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

  return (
    <div className="container py-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
        <Link to="/cataleg" className="hover:text-primary">{t('products.catalog')}</Link>
        <span>/</span>
        <span className="text-foreground truncate">{product.name}</span>
      </nav>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        {/* Image gallery */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="aspect-square overflow-hidden rounded-lg bg-muted mb-3 relative">
            <img
              src={images[selectedImageIdx].image_url}
              alt={images[selectedImageIdx].alt_text || product.name}
              className="h-full w-full object-cover"
            />
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
          {/* Thumbnails */}
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

        {/* Product info */}
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

          <div className="flex items-center gap-3">
            <span className="font-display text-2xl font-bold text-primary">
              {formatPrice(currentPrice)}
            </span>
            {product.taxName && (
              <span className="text-xs text-muted-foreground">({product.taxName} {product.taxPercentage}% inclòs)</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {product.stockStatus === 'in_stock' && (
              <Badge variant="secondary" className="bg-sage text-sage-foreground">{t('products.inStock')}</Badge>
            )}
            {product.stockStatus === 'on_order' && (
              <Badge variant="secondary" className="bg-warm text-warm-foreground">{t('products.onOrder')}</Badge>
            )}
            {product.stockStatus === 'out_of_stock' && (
              <Badge variant="destructive">{t('products.outOfStock')}</Badge>
            )}
          </div>

          {product.shortDescription && (
            <p className="text-muted-foreground leading-relaxed">{product.shortDescription}</p>
          )}

          <Separator />

          {/* Variant selectors */}
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
                    {v.priceOverride && v.priceOverride !== product.basePrice && (
                      <span className="ml-1 text-xs">({formatPrice(v.priceOverride)})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Quantity + add to cart */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex items-center border border-border rounded-md">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                className="p-2 hover:bg-muted transition-colors"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="px-4 text-sm font-medium min-w-[2rem] text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(q => q + 1)}
                className="p-2 hover:bg-muted transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <Button
              size="lg"
              className="flex-1 gap-2"
              onClick={handleAddToCart}
              disabled={product.stockStatus === 'out_of_stock'}
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

          <Separator />

          {/* Full description */}
          <div>
            <h2 className="font-display text-lg font-semibold mb-2">Descripció</h2>
            <div className="prose prose-sm text-muted-foreground whitespace-pre-wrap">
              {product.description}
            </div>
          </div>

          {/* SKU */}
          <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
        </motion.div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
