import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Search, Clock, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useDefaultListSections, pickSectionName } from '@/hooks/useDefaultListSections';
import {
  useFamilyProducts,
  productIsAvailable,
  pickProductName,
  primaryImage,
  type FamilyProduct,
} from '@/hooks/useFamilyProducts';
import { formatPrice } from '@/hooks/useTaxRates';

export interface FamilyProductSelectorProps {
  selectedIds: Set<string>;
  onToggle: (product: FamilyProduct, checked: boolean) => void;
  /** When set, hides the family ID(s) (e.g. to exclude an empty bucket). */
  hideEmptyFamilies?: boolean;
}

/**
 * Full-width grid grouped by default-list sections (families). Each product
 * has a check toggle to include / exclude it from the current birth list / template.
 * - Discontinued / out-of-stock products are hidden by the data hook OR rendered disabled.
 * - "on_order" products show an "En estoc, sota comanda" badge and remain selectable.
 */
const FamilyProductSelector: React.FC<FamilyProductSelectorProps> = ({
  selectedIds,
  onToggle,
  hideEmptyFamilies = true,
}) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'ca';
  const [search, setSearch] = useState('');

  const { data: sections = [], isLoading: loadingSections } = useDefaultListSections({ onlyActive: true });
  const { data: products = [], isLoading: loadingProducts } = useFamilyProducts();

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filter = (p: FamilyProduct) => {
      if (!q) return true;
      const n = pickProductName(p, lang).toLowerCase();
      return n.includes(q) || p.sku.toLowerCase().includes(q);
    };
    const visible = products.filter(filter);

    const bySection = new Map<string, FamilyProduct[]>();
    for (const s of sections) bySection.set(s.id, []);
    const orphans: FamilyProduct[] = [];
    for (const p of visible) {
      if (p.default_section_id && bySection.has(p.default_section_id)) {
        bySection.get(p.default_section_id)!.push(p);
      } else {
        orphans.push(p);
      }
    }
    return { bySection, orphans };
  }, [products, sections, search, lang]);

  if (loadingSections || loadingProducts) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{t('common.loading')}</p>;
  }

  const orphanLabel = lang === 'es' ? 'Sin familia' : 'Sense família';

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-3 -mx-1 px-1 border-b">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="relative w-full sm:w-96 max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-10"
              placeholder={lang === 'es' ? 'Buscar producto o SKU…' : 'Cercar producte o SKU…'}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{selectedIds.size}</span>
            {' '}{lang === 'es' ? 'productos seleccionados' : 'productes seleccionats'}
          </div>
        </div>
      </div>

      {sections.map(section => {
        const list = grouped.bySection.get(section.id) || [];
        if (hideEmptyFamilies && list.length === 0) return null;
        return (
          <FamilyBlock
            key={section.id}
            title={pickSectionName(section, lang)}
            products={list}
            lang={lang}
            selectedIds={selectedIds}
            onToggle={onToggle}
          />
        );
      })}

      {grouped.orphans.length > 0 && (
        <FamilyBlock
          title={orphanLabel}
          products={grouped.orphans}
          lang={lang}
          selectedIds={selectedIds}
          onToggle={onToggle}
          muted
        />
      )}
    </div>
  );
};

const FamilyBlock: React.FC<{
  title: string;
  products: FamilyProduct[];
  lang: string;
  selectedIds: Set<string>;
  onToggle: (p: FamilyProduct, checked: boolean) => void;
  muted?: boolean;
}> = ({ title, products, lang, selectedIds, onToggle, muted }) => (
  <section aria-label={title}>
    <header className="flex items-center gap-2 mb-3">
      <h3 className={cn('font-display text-lg font-semibold', muted && 'text-muted-foreground')}>{title}</h3>
      <Badge variant="secondary">{products.length}</Badge>
    </header>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {products.map(p => (
        <ProductTile key={p.id} product={p} lang={lang} selected={selectedIds.has(p.id)} onToggle={onToggle} />
      ))}
      {products.length === 0 && (
        <p className="col-span-full text-sm text-muted-foreground py-4 text-center bg-muted/30 rounded">
          {lang === 'es' ? 'Sin productos en esta familia' : 'Sense productes en aquesta família'}
        </p>
      )}
    </div>
  </section>
);

const ProductTile: React.FC<{
  product: FamilyProduct;
  lang: string;
  selected: boolean;
  onToggle: (p: FamilyProduct, checked: boolean) => void;
}> = ({ product: p, lang, selected, onToggle }) => {
  const { t } = useTranslation();
  const available = productIsAvailable(p);
  const onOrder = p.stock_status === 'on_order';
  const name = pickProductName(p, lang);
  const img = primaryImage(p);
  const disabled = !available;

  const toggle = () => {
    if (disabled) return;
    onToggle(p, !selected);
  };

  return (
    <div
      role="checkbox"
      aria-checked={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={toggle}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggle();
        }
      }}
      className={cn(
        'group relative rounded-lg border bg-card overflow-hidden text-left transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-emerald-500 ring-2 ring-emerald-500/40 shadow-md'
          : 'border-border hover:border-primary/40 hover:shadow-sm',
        disabled && 'opacity-60 cursor-not-allowed grayscale',
        !disabled && 'cursor-pointer',
      )}
    >
      {selected && (
        <div
          className="absolute top-2 right-2 z-10 rounded-full bg-emerald-500 text-white p-1 shadow"
          aria-hidden="true"
        >
          <Check className="h-3.5 w-3.5" />
        </div>
      )}
      <div className="aspect-square bg-muted">
        <img src={img} alt={name} className="h-full w-full object-cover" loading="lazy" />
      </div>
      <div className="p-2.5 space-y-1">
        <p className="text-sm font-medium line-clamp-2 leading-tight">{name}</p>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm font-semibold">{formatPrice(p.base_price)}</span>
          {onOrder && (
            <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400 gap-1 text-[10px]">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {t('products.onOrder')}
            </Badge>
          )}
          {!onOrder && !available && (
            <Badge variant="destructive" className="gap-1 text-[10px]">
              <Package className="h-3 w-3" aria-hidden="true" />
              {t('products.outOfStock')}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
};


export default FamilyProductSelector;
