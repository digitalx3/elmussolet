import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { Heart, Gift, Search, ShoppingBag, Calendar, Check, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useListAccess } from '@/contexts/ListAccessContext';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/lib/notify';
import PublicListSteps from '@/components/list/PublicListSteps';
import NoIndex from '@/components/seo/NoIndex';

interface ListSection {
  id: string;
  name_ca: string;
  name_es: string;
  sort_order: number;
  translations?: Array<{ language_code: string; name: string }>;
}

interface ListItemWithProduct {
  id: string;
  product_id: string;
  variant_id: string | null;
  section_id: string | null;
  quantity_desired: number;
  quantity_purchased: number;
  priority: string;
  sort_order: number;
  product: {
    id: string;
    slug: string;
    base_price: number;
    has_variants: boolean;
    stock_quantity: number;
    stock_status: string;
    product_translations: Array<{ language: string; name: string; short_description: string | null }>;
    product_images: Array<{ image_url: string; is_primary: boolean; alt_text: string | null }>;
  };
  variant?: {
    id: string;
    value: string;
    price_override: number | null;
    stock_quantity: number;
    variant_type_id: string;
  } | null;
}


const BirthListViewPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { listCode } = useParams<{ listCode: string }>();
  const { hasAccess, listId, babyName, owners, expectedDate, token, clearAccess } = useListAccess();
  const { addListItem } = useCart();
  const [items, setItems] = useState<ListItemWithProduct[]>([]);
  const [sections, setSections] = useState<ListSection[]>([]);
  const [blockSummary, setBlockSummary] = useState<Record<string, { reserved: number; delivered: number }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const lang = i18n.language === 'es' ? 'es' : i18n.language === 'ca' ? 'ca' : i18n.language || 'ca';

  const resolveSectionName = (sec: ListSection): string => {
    const tr = sec.translations?.find(t => t.language_code === lang)?.name;
    if (tr && tr.trim()) return tr;
    if (lang === 'es' && sec.name_es) return sec.name_es;
    if (lang === 'ca' && sec.name_ca) return sec.name_ca;
    const anyTr = sec.translations?.find(t => t.name && t.name.trim())?.name;
    return anyTr || sec.name_ca || sec.name_es || '';
  };

  useEffect(() => {
    if (!hasAccess || !listId) {
      navigate('/llista-naixement');
      return;
    }
    fetchListItems();
  }, [hasAccess, listId]);

  const fetchListItems = async () => {
    setLoading(true);
    try {
      // Public registry data is fetched through an edge function so the tightened
      // RLS on list_items / list_sections cannot expose other lists to gift buyers.
      const { data, error } = await supabase.functions.invoke('get-public-list-data', {
        body: { listCode: (listCode || '').trim(), token },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const payload = data as {
        items: ListItemWithProduct[];
        sections: ListSection[];
        blockSummary: Array<{ list_item_id: string; reserved_qty: number; delivered_qty: number }>;
      };

      setSections(payload.sections || []);
      setItems(payload.items || []);

      const map: Record<string, { reserved: number; delivered: number }> = {};
      (payload.blockSummary || []).forEach((r) => {
        if (r.list_item_id) {
          map[r.list_item_id] = { reserved: r.reserved_qty ?? 0, delivered: r.delivered_qty ?? 0 };
        }
      });
      setBlockSummary(map);
    } catch {
      notify.error(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };



  const getProductName = (item: ListItemWithProduct) => {
    const tr = item.product.product_translations.find(t => t.language === lang)
      || item.product.product_translations[0];
    return tr?.name || '';
  };

  const getProductImage = (item: ListItemWithProduct) => {
    const primary = item.product.product_images.find(i => i.is_primary);
    return (primary || item.product.product_images[0])?.image_url || '/placeholder.svg';
  };

  const getPrice = (item: ListItemWithProduct) => {
    const base = item.variant?.price_override != null ? item.variant.price_override : item.product.base_price;
    const taxPct = (item.product as any).tax_rates?.percentage ?? 0;
    return base * (1 + taxPct / 100);
  };

  const getStatus = (item: ListItemWithProduct) => {
    if (item.quantity_purchased >= item.quantity_desired) return 'purchased';
    if (item.quantity_purchased > 0) return 'partial';
    return 'available';
  };

  const remaining = (item: ListItemWithProduct) =>
    Math.max(0, item.quantity_desired - item.quantity_purchased);

  const handleBuyGift = (item: ListItemWithProduct) => {
    const qty = remaining(item);
    if (qty <= 0) return;

    // If the product has selectable attributes/variants and the list owner
    // did not lock a specific variant, redirect the buyer to the product page
    // so they can choose the attributes before adding to the cart.
    if (item.product.has_variants && !item.variant_id) {
      navigate(`/producte/${item.product.slug}?gift=${item.id}&listId=${listId}`);
      return;
    }

    const base = item.variant?.price_override != null ? item.variant.price_override : item.product.base_price;
    const taxPct = (item.product as any).tax_rates?.percentage ?? 0;
    addListItem({
      productId: item.product_id,
      variantId: item.variant_id || undefined,
      listItemId: item.id,
      name: getProductName(item) + (item.variant ? ` (${item.variant.value})` : ''),
      image: getProductImage(item),
      price: getPrice(item),
      basePriceNoTax: base,
      taxPercentage: taxPct,
      quantity: 1,
      maxQuantity: qty,
      variantLabel: item.variant?.value,
    }, listId!);

    notify.success(t('list.giftAdded'));
  };

  const totalItems = items.reduce((s, i) => s + i.quantity_desired, 0);
  const totalPurchased = items.reduce((s, i) => s + Math.min(i.quantity_purchased, i.quantity_desired), 0);
  const progressPct = totalItems > 0 ? Math.round((totalPurchased / totalItems) * 100) : 0;

  const filteredItems = items.filter(item => {
    if (!search.trim()) return true;
    return getProductName(item).toLowerCase().includes(search.toLowerCase());
  });

  const ownerNames = owners.map(o => `${o.firstName} ${o.lastName}`).join(' & ');

  if (!hasAccess) return null;

  return (
    <div className="container py-8 max-w-4xl mx-auto">
      <NoIndex />
      <PublicListSteps current="view" />
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <Heart className="h-10 w-10 text-primary mx-auto mb-3" />
        {babyName && (
          <h1 className="font-display text-3xl font-bold mb-1">
            {t('list.listFor')} {babyName}
          </h1>
        )}
        {ownerNames && (
          <p className="text-lg text-muted-foreground mb-1">{ownerNames}</p>
        )}
        {expectedDate && (
          <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
            <Calendar className="h-4 w-4" />
            {new Date(expectedDate).toLocaleDateString(lang === 'ca' ? 'ca-ES' : 'es-ES', {
              year: 'numeric', month: 'long', day: 'numeric'
            })}
          </p>
        )}
      </motion.div>

      {/* Progress */}
      <div className="bg-card rounded-lg p-4 shadow-soft mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium">{t('list.progress')}</span>
          <span className="text-sm text-muted-foreground">{progressPct}%</span>
        </div>
        <Progress value={progressPct} className="h-2" />
        <p className="text-xs text-muted-foreground mt-1">
          {totalPurchased} / {totalItems} {t('list.itemsPurchased')}
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('list.searchProducts')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Items */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12">
          <Gift className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">{search ? t('common.noResults') : t('list.emptyList')}</p>
        </div>
      ) : (() => {
          const renderItem = (item: ListItemWithProduct, index: number) => {
            const status = getStatus(item);
            const isPurchased = status === 'purchased';
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index, 8) * 0.04 }}
                className={`flex gap-4 p-4 rounded-lg bg-card shadow-soft ${isPurchased ? 'opacity-60' : ''}`}
              >
                <div className="w-20 h-20 rounded-md overflow-hidden flex-shrink-0 bg-muted">
                  <img src={getProductImage(item)} alt={getProductName(item)} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium text-sm leading-tight line-clamp-2">
                        {getProductName(item)}
                        {item.variant && (
                          <span className="text-muted-foreground ml-1">({item.variant.value})</span>
                        )}
                      </h3>
                      {item.variant_id && (
                        <Badge variant="outline" className="mt-1 text-[10px] border-primary/40 text-primary gap-1">
                          <Check className="h-3 w-3" />
                          {lang === 'es' ? 'Configuración escogida por la familia' : 'Configuració escollida per la família'}
                        </Badge>
                      )}
                      <p className="text-primary font-semibold text-sm mt-1">{getPrice(item).toFixed(2)} €</p>
                      {(() => {
                        const hasVariants = (item.product as any).has_variants;
                        const stockQty = item.variant ? item.variant.stock_quantity : item.product.stock_quantity;
                        const stockStatus = item.product.stock_status;
                        // When the product has selectable variants and none is locked,
                        // the product-level stock badge isn't reliable — hide it.
                        if (hasVariants && !item.variant) return null;
                        if (stockStatus === 'in_stock' && stockQty === 1) {
                          return <Badge variant="secondary" className="mt-1 bg-last-unit text-last-unit-foreground">{t('products.lastUnit')}</Badge>;
                        }
                        if (stockStatus === 'in_stock') {
                          return <Badge variant="secondary" className="mt-1 bg-sage text-sage-foreground">{t('products.inStock')}</Badge>;
                        }
                        if (stockStatus === 'on_order') {
                          return <Badge variant="secondary" className="mt-1 bg-warm text-warm-foreground">{t('products.onOrder')}</Badge>;
                        }
                        if (stockStatus === 'out_of_stock') {
                          return <Badge variant="destructive" className="mt-1">{t('products.outOfStock')}</Badge>;
                        }
                        return null;
                      })()}
                    </div>
                    {(() => {
                      const summary = blockSummary[item.id] || { reserved: 0, delivered: 0 };
                      const reservedLabel = lang === 'es' ? 'Reservado' : 'Reservat';
                      const deliveredLabel = lang === 'es' ? 'Entregado' : 'Entregat';
                      const badges: JSX.Element[] = [];
                      if (summary.delivered > 0) {
                        badges.push(
                          <Badge key="delivered" variant="secondary" className="flex-shrink-0 gap-1">
                            <Check className="h-3 w-3" />{deliveredLabel} ({summary.delivered})
                          </Badge>
                        );
                      }
                      if (summary.reserved > 0) {
                        badges.push(
                          <Badge key="reserved" variant="outline" className="flex-shrink-0 gap-1 border-warm text-warm-foreground bg-warm/20">
                            <Minus className="h-3 w-3" />{reservedLabel} ({summary.reserved})
                          </Badge>
                        );
                      }
                      if (badges.length === 0 && status === 'partial') {
                        badges.push(
                          <Badge key="partial" variant="outline" className="flex-shrink-0 gap-1 border-accent text-accent">
                            <Minus className="h-3 w-3" />{item.quantity_purchased}/{item.quantity_desired}
                          </Badge>
                        );
                      }
                      if (badges.length === 0 && status === 'purchased') {
                        badges.push(
                          <Badge key="purchased" variant="secondary" className="flex-shrink-0 gap-1">
                            <Check className="h-3 w-3" />{t('list.purchased')}
                          </Badge>
                        );
                      }
                      return <div className="flex flex-col gap-1 items-end">{badges}</div>;
                    })()}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {item.quantity_desired > 1 && `${t('products.quantity')}: ${item.quantity_desired}`}
                    </span>
                    {!isPurchased && (
                      <Button size="sm" onClick={() => handleBuyGift(item)} className="gap-1 text-xs">
                        <ShoppingBag className="h-3 w-3" />{t('list.buyGift')}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          };

          if (sections.length === 0) {
            return <div className="space-y-3">{filteredItems.map(renderItem)}</div>;
          }

          const grouped = sections.map(sec => ({
            section: sec,
            items: filteredItems.filter(i => i.section_id === sec.id),
          }));
          const uncategorized = filteredItems.filter(i => !i.section_id || !sections.some(s => s.id === i.section_id));

          return (
            <div className="space-y-8">
              {grouped.map(g => g.items.length > 0 && (
                <section key={g.section.id}>
                  <h2 className="font-display text-xl font-semibold mb-3 pb-2 border-b border-border">
                    {resolveSectionName(g.section)}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">({g.items.length})</span>
                  </h2>
                  <div className="space-y-3">{g.items.map(renderItem)}</div>
                </section>
              ))}
              {uncategorized.length > 0 && (
                <section>
                  <h2 className="font-display text-xl font-semibold mb-3 pb-2 border-b border-border">
                    {t('list.otherGifts')}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">({uncategorized.length})</span>
                  </h2>
                  <div className="space-y-3">{uncategorized.map(renderItem)}</div>
                </section>
              )}
            </div>
          );
        })()}


      {/* Cart CTA */}
      <div className="mt-8 text-center">
        <Button variant="outline" onClick={() => clearAccess()} className="mr-3">
          {t('list.exitList')}
        </Button>
        <Button onClick={() => navigate('/cistella')} className="gap-2">
          <ShoppingBag className="h-4 w-4" />
          {t('list.viewCart')}
        </Button>
      </div>
    </div>
  );
};

export default BirthListViewPage;
