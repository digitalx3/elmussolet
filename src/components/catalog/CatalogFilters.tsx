import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, ChevronDown, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { TranslatedCategory } from '@/hooks/useCategories';
import type { Brand } from '@/hooks/useBrands';

interface Props {
  categories: TranslatedCategory[];
  brands: Brand[];
  selectedCategory: string | undefined;
  selectedBrandIds: string[];
  selectedAvailability: string | undefined;
  priceRange: [number, number];
  maxPrice: number;
  search: string;
  onCategoryChange: (id: string | undefined) => void;
  onBrandIdsChange: (ids: string[]) => void;
  onAvailabilityChange: (val: string | undefined) => void;
  onPriceRangeChange: (range: [number, number]) => void;
  onSearchChange: (val: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

const CatalogFilters: React.FC<Props> = ({
  categories, brands,
  selectedCategory, selectedBrandIds, selectedAvailability,
  priceRange, maxPrice, search,
  onCategoryChange, onBrandIdsChange, onAvailabilityChange,
  onPriceRangeChange, onSearchChange, onClearFilters,
  hasActiveFilters,
}) => {
  const { t } = useTranslation();
  const [brandSearch, setBrandSearch] = useState('');

  const availabilityOptions = [
    { value: 'in_stock', label: t('products.inStock') },
    { value: 'on_order', label: t('products.onOrder') },
    { value: 'out_of_stock', label: t('products.outOfStock') },
  ];

  const filteredBrands = useMemo(() => {
    const q = brandSearch.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter(b => b.name.toLowerCase().includes(q));
  }, [brands, brandSearch]);

  const toggleBrand = (id: string) => {
    if (selectedBrandIds.includes(id)) {
      onBrandIdsChange(selectedBrandIds.filter(x => x !== id));
    } else {
      onBrandIdsChange([...selectedBrandIds, id]);
    }
  };

  const selectedBrands = brands.filter(b => selectedBrandIds.includes(b.id));
  const brandButtonLabel =
    selectedBrandIds.length === 0
      ? t('common.all')
      : selectedBrandIds.length === 1
        ? selectedBrands[0]?.name ?? ''
        : `${selectedBrandIds.length} ${t('products.brands', { defaultValue: 'marques' })}`;

  return (
    <aside className="space-y-6">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('products.search')}
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-9"
        />
        {search && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Clear all filters */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1"
          onClick={onClearFilters}
        >
          <X className="h-4 w-4" />
          {t('products.clearFilters')}
        </Button>
      )}

      {/* Categories */}
      <div>
        <Label className="text-sm font-semibold mb-2 block">{t('products.category')}</Label>
        <div className="space-y-1">
          <button
            onClick={() => onCategoryChange(undefined)}
            className={`block w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors ${!selectedCategory ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/80 hover:bg-muted'}`}
          >
            {t('products.allProducts')}
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => onCategoryChange(cat.id === selectedCategory ? undefined : cat.id)}
              className={`block w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors ${cat.id === selectedCategory ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/80 hover:bg-muted'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Availability — moved between Category and Brand */}
      <div>
        <Label className="text-sm font-semibold mb-2 block">{t('products.availability')}</Label>
        <div className="space-y-2">
          {availabilityOptions.map(opt => (
            <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={selectedAvailability === opt.value}
                onCheckedChange={(checked) =>
                  onAvailabilityChange(checked ? opt.value : undefined)
                }
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {/* Brands — multiselect dropdown */}
      {brands.length > 0 && (
        <div>
          <Label className="text-sm font-semibold mb-2 block">{t('products.brand')}</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between font-normal"
              >
                <span className="truncate text-left">{brandButtonLabel}</span>
                <ChevronDown className="h-4 w-4 opacity-60 shrink-0 ml-2" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={brandSearch}
                    onChange={e => setBrandSearch(e.target.value)}
                    placeholder={t('products.search')}
                    className="h-8 pl-7 text-sm"
                  />
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto py-1">
                {filteredBrands.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-3 text-center">
                    {t('products.noResults')}
                  </p>
                ) : (
                  filteredBrands.map(brand => {
                    const checked = selectedBrandIds.includes(brand.id);
                    return (
                      <button
                        key={brand.id}
                        type="button"
                        onClick={() => toggleBrand(brand.id)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-muted transition-colors',
                          checked && 'bg-primary/5'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-4 w-4 items-center justify-center rounded border',
                            checked ? 'bg-primary border-primary text-primary-foreground' : 'border-input'
                          )}
                          aria-hidden="true"
                        >
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                        <span className="truncate">{brand.name}</span>
                      </button>
                    );
                  })
                )}
              </div>
              {selectedBrandIds.length > 0 && (
                <div className="p-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-7 text-xs"
                    onClick={() => onBrandIdsChange([])}
                  >
                    {t('products.clearFilters')}
                  </Button>
                </div>
              )}
            </PopoverContent>
          </Popover>

          {selectedBrands.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedBrands.map(b => (
                <Badge
                  key={b.id}
                  variant="secondary"
                  className="gap-1 pl-2 pr-1 py-0.5"
                >
                  <span className="truncate max-w-[120px]">{b.name}</span>
                  <button
                    type="button"
                    onClick={() => toggleBrand(b.id)}
                    className="hover:bg-background/60 rounded p-0.5"
                    aria-label={`Remove ${b.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clear filters */}
      {hasActiveFilters && (
        <>
          <Separator />
          <Button variant="outline" size="sm" className="w-full" onClick={onClearFilters}>
            <X className="h-4 w-4 mr-1" />
            {t('products.clearFilters')}
          </Button>
        </>
      )}
    </aside>
  );
};

export default CatalogFilters;
