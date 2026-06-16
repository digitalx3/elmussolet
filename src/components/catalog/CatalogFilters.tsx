import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import type { TranslatedCategory } from '@/hooks/useCategories';
import type { Brand } from '@/hooks/useBrands';

interface Props {
  categories: TranslatedCategory[];
  brands: Brand[];
  selectedCategory: string | undefined;
  selectedBrand: string | undefined;
  selectedAvailability: string | undefined;
  priceRange: [number, number];
  maxPrice: number;
  search: string;
  onCategoryChange: (id: string | undefined) => void;
  onBrandChange: (id: string | undefined) => void;
  onAvailabilityChange: (val: string | undefined) => void;
  onPriceRangeChange: (range: [number, number]) => void;
  onSearchChange: (val: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

const CatalogFilters: React.FC<Props> = ({
  categories, brands,
  selectedCategory, selectedBrand, selectedAvailability,
  priceRange, maxPrice, search,
  onCategoryChange, onBrandChange, onAvailabilityChange,
  onPriceRangeChange, onSearchChange, onClearFilters,
  hasActiveFilters,
}) => {
  const { t } = useTranslation();

  const availabilityOptions = [
    { value: 'in_stock', label: t('products.inStock') },
    { value: 'on_order', label: t('products.onOrder') },
    { value: 'out_of_stock', label: t('products.outOfStock') },
  ];

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(price);

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

      {/* Categories */}
      <div>
        <Label className="text-sm font-semibold mb-2 block">{t('products.category')}</Label>
        <div className="max-h-60 overflow-y-auto pr-1 space-y-1">
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

      {/* Brands */}
      {brands.length > 0 && (
        <div>
          <Label className="text-sm font-semibold mb-2 block">{t('products.brand')}</Label>
          <div className="max-h-60 overflow-y-auto pr-1 space-y-1">
            <button
              onClick={() => onBrandChange(undefined)}
              className={`block w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors ${!selectedBrand ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/80 hover:bg-muted'}`}
            >
              {t('common.all')}
            </button>
            {brands.map(brand => (
              <button
                key={brand.id}
                onClick={() => onBrandChange(brand.id === selectedBrand ? undefined : brand.id)}
                className={`block w-full text-left text-sm px-2 py-1.5 rounded-md transition-colors ${brand.id === selectedBrand ? 'bg-primary/10 text-primary font-medium' : 'text-foreground/80 hover:bg-muted'}`}
              >
                {brand.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <Separator />

      {/* Price range */}
      <div>
        <Label className="text-sm font-semibold mb-3 block">{t('products.price')}</Label>
        <Slider
          value={priceRange}
          onValueChange={(v) => onPriceRangeChange(v as [number, number])}
          min={0}
          max={maxPrice}
          step={1}
          className="mb-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatPrice(priceRange[0])}</span>
          <span>{formatPrice(priceRange[1])}</span>
        </div>
      </div>

      <Separator />

      {/* Availability */}
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
