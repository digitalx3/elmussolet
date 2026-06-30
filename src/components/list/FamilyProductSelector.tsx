import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Search, Clock, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDefaultListSections, pickSectionName } from '@/hooks/useDefaultListSections';
import { useDefaultListSubsections, pickSubsectionName } from '@/hooks/useDefaultListSubsections';
import {
  useFamilyProducts,
  useFamilyAssignmentCounts,
  productIsAvailable,
  pickProductName,
  primaryImage,
  type FamilyProduct,
} from '@/hooks/useFamilyProducts';
import { formatPrice } from '@/hooks/useTaxRates';

export interface FamilyProductSelectorProps {
  selectedIds: Set<string>;
  onToggle: (product: FamilyProduct, checked: boolean) => void;
}

interface SubsectionGroup {
  subsection_id: string | null;
  name: string;
  products: FamilyProduct[];
}

const FamilyProductSelector: React.FC<FamilyProductSelectorProps> = ({
  selectedIds,
  onToggle,
}) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'ca';
  const [search, setSearch] = useState('');

  const { data: sections = [], isLoading: loadingSections } = useDefaultListSections({ onlyActive: true });
  const { data: subsections = [], isLoading: loadingSubs } = useDefaultListSubsections({ onlyActive: true });
  const { data: products = [], isLoading: loadingProducts } = useFamilyProducts();
  const { data: assignmentCounts } = useFamilyAssignmentCounts();

  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchesSearch = (p: FamilyProduct) => {
      if (!q) return true;
      const n = pickProductName(p, lang).toLowerCase();
      return n.includes(q) || p.sku.toLowerCase().includes(q);
    };

    const visible = products.filter(p => productIsAvailable(p) && matchesSearch(p));

    // section_id -> subsection_id (or "_general") -> products
    const map = new Map<string, Map<string, FamilyProduct[]>>();
    for (const s of sections) map.set(s.id, new Map());
    for (const p of visible) {
      for (const a of p.assignments) {
        const bySection = map.get(a.section_id);
        if (!bySection) continue;
        const key = a.subsection_id || '_general';
        if (!bySection.has(key)) bySection.set(key, []);
        bySection.get(key)!.push(p);
      }
    }
    return { map, searchActive: q.length > 0 };
  }, [products, sections, search, lang]);

  if (loadingSections || loadingSubs || loadingProducts) {
    return <p className="text-sm text-muted-foreground py-6 text-center">{t('common.loading')}</p>;
  }

  return (
    <div className="space-y-8">
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
        const sectionMap = grouped.map.get(section.id) || new Map();
        const sectionSubs = subsections.filter(s => s.section_id === section.id);
        const assignedCount = assignmentCounts?.get(section.id) ?? 0;

        // Build ordered groups: General first if any, then subsections in sort_order.
        const groups: SubsectionGroup[] = [];
        const general = sectionMap.get('_general');
        if (general && general.length > 0) {
          groups.push({
            subsection_id: null,
            name: lang === 'es' ? 'General' : 'General',
            products: general,
          });
        }
        for (const sub of sectionSubs) {
          const list = sectionMap.get(sub.id);
          if (list && list.length > 0) {
            groups.push({
              subsection_id: sub.id,
              name: pickSubsectionName(sub, lang),
              products: list,
            });
          }
        }

        const totalVisible = groups.reduce((s, g) => s + g.products.length, 0);

        return (
          <section key={section.id} aria-label={pickSectionName(section, lang)} className="space-y-4">
            <header className="flex items-center gap-2 border-b pb-2">
              <h3 className="font-display text-xl font-semibold">{pickSectionName(section, lang)}</h3>
              <Badge variant="secondary">{totalVisible}</Badge>
            </header>

            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center bg-muted/30 rounded">
                {grouped.searchActive
                  ? t('list.familyNoSearchResults')
                  : assignedCount > 0
                    ? t('list.familyAllOutOfStock')
                    : t('list.familyNoProducts')}
              </p>
            ) : (
              groups.map(g => (
                <div key={g.subsection_id ?? '_general'} className="space-y-2">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {g.name} <span className="text-xs font-normal">({g.products.length})</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {g.products.map(p => (
                      <ProductTile
                        key={`${g.subsection_id ?? 'gen'}-${p.id}`}
                        product={p}
                        lang={lang}
                        selected={selectedIds.has(p.id)}
                        onToggle={onToggle}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        );
      })}
    </div>
  );
};

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
