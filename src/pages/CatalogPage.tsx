import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { LayoutGrid, List, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import CatalogFilters from '@/components/catalog/CatalogFilters';
import ProductCard from '@/components/catalog/ProductCard';
import { useTranslatedProducts, type ProductFilters } from '@/hooks/useTranslatedProducts';
import { useCategories } from '@/hooks/useCategories';
import { useBrands } from '@/hooks/useBrands';

const MAX_PRICE_DEFAULT = 10000;

const CatalogPage: React.FC = () => {
  const { t } = useTranslation();
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();

  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>(() => {
    const param = searchParams.get('brand');
    return param ? [param] : [];
  });
  const [selectedAvailability, setSelectedAvailability] = useState<string | undefined>(undefined);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, MAX_PRICE_DEFAULT]);
  const [sortBy, setSortBy] = useState<ProductFilters['sortBy']>('newest');
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const { data: categories = [] } = useCategories();
  const { data: brands = [] } = useBrands();

  // Resolve category slug to ID
  const resolvedCategoryId = useMemo(() => {
    if (selectedCategory) return selectedCategory;
    if (categorySlug) {
      const found = categories.find(c => c.slug === categorySlug);
      return found?.id;
    }
    return undefined;
  }, [categorySlug, selectedCategory, categories]);

  const filters: ProductFilters = {
    categoryId: resolvedCategoryId,
    brandIds: selectedBrandIds.length > 0 ? selectedBrandIds : undefined,
    search: search || undefined,
    minPrice: priceRange[0] > 0 ? priceRange[0] : undefined,
    maxPrice: priceRange[1] < MAX_PRICE_DEFAULT ? priceRange[1] : undefined,
    availability: selectedAvailability,
    sortBy,
    page,
    perPage: 12,
  };

  const { data, isLoading } = useTranslatedProducts(filters);

  const hasActiveFilters = !!(selectedCategory || selectedBrandIds.length > 0 || selectedAvailability || search || priceRange[0] > 0 || priceRange[1] < MAX_PRICE_DEFAULT);

  const clearFilters = () => {
    setSelectedCategory(undefined);
    setSelectedBrandIds([]);
    setSelectedAvailability(undefined);
    setPriceRange([0, MAX_PRICE_DEFAULT]);
    setSearch('');
    setPage(1);
    if (searchParams.has('brand') || searchParams.has('q')) {
      setSearchParams({}, { replace: true });
    }
  };

  const currentBrandName = useMemo(
    () => (selectedBrandIds.length === 1 ? brands.find(b => b.id === selectedBrandIds[0])?.name : undefined),
    [selectedBrandIds, brands]
  );

  const currentCategoryName = useMemo(() => {
    if (resolvedCategoryId) {
      return categories.find(c => c.id === resolvedCategoryId)?.name;
    }
    return undefined;
  }, [resolvedCategoryId, categories]);

  const filtersComponent = (
    <CatalogFilters
      categories={categories}
      brands={brands}
      selectedCategory={selectedCategory || (categorySlug ? resolvedCategoryId : undefined)}
      selectedBrandIds={selectedBrandIds}
      selectedAvailability={selectedAvailability}
      priceRange={priceRange}
      maxPrice={MAX_PRICE_DEFAULT}
      search={search}
      onCategoryChange={(id) => { setSelectedCategory(id); setPage(1); }}
      onBrandIdsChange={(ids) => { setSelectedBrandIds(ids); setPage(1); }}
      onAvailabilityChange={(val) => { setSelectedAvailability(val); setPage(1); }}
      onPriceRangeChange={(range) => { setPriceRange(range); setPage(1); }}
      onSearchChange={(val) => { setSearch(val); setPage(1); }}
      onClearFilters={clearFilters}
      hasActiveFilters={hasActiveFilters}
    />
  );

  return (
    <div className="container py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">
            {currentCategoryName ?? t('products.catalog')}
          </h1>
          {data && (
            <p className="text-sm text-muted-foreground mt-1">
              {t('products.productCount', { count: data.total })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile filters button */}
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="md:hidden gap-1">
                <SlidersHorizontal className="h-4 w-4" />
                {t('products.filters')}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-6">
              <SheetHeader>
                <SheetTitle>{t('products.filters')}</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                {filtersComponent}
              </div>
            </SheetContent>
          </Sheet>

          {/* Sort */}
          <Select value={sortBy} onValueChange={(v) => { setSortBy(v as ProductFilters['sortBy']); setPage(1); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('products.sort')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">{t('products.sortNew')}</SelectItem>
              <SelectItem value="price_asc">{t('products.sortPriceAsc')}</SelectItem>
              <SelectItem value="price_desc">{t('products.sortPriceDesc')}</SelectItem>
              <SelectItem value="name_asc">{t('products.sortName')}</SelectItem>
              <SelectItem value="name_desc">{t('products.sortNameDesc')}</SelectItem>
            </SelectContent>
          </Select>

          {/* View toggle */}
          <div className="hidden sm:flex border border-border rounded-md overflow-hidden">
            <button
              onClick={() => setView('grid')}
              className={`p-2 transition-colors ${view === 'grid' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView('list')}
              className={`p-2 transition-colors ${view === 'list' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Desktop sidebar filters */}
        <div className="hidden md:block w-64 flex-shrink-0">
          {filtersComponent}
        </div>

        {/* Products grid */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className={view === 'grid' ? 'grid grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className={view === 'grid' ? 'aspect-square rounded-lg' : 'h-32 rounded-lg'} />
              ))}
            </div>
          ) : !data?.products.length ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-lg font-medium text-foreground mb-1">
                {currentBrandName
                  ? t('products.noResultsForBrand', { brand: currentBrandName, defaultValue: `Cap producte de {{brand}}` })
                  : t('products.noResults')}
              </p>
              <p className="text-sm text-muted-foreground">
                {currentBrandName
                  ? t('products.noResultsForBrandDesc', 'Encara no hi ha productes actius per a aquest fabricant.')
                  : t('products.noResultsDesc')}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                  {t('products.clearFilters')}
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className={
                view === 'grid'
                  ? 'grid grid-cols-2 lg:grid-cols-3 gap-4'
                  : 'space-y-4'
              }>
                {data.products.map(product => (
                  <ProductCard key={product.id} product={product} view={view} />
                ))}
              </div>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    {t('common.previous')}
                  </Button>
                  <span className="text-sm text-muted-foreground px-3">
                    {page} / {data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    {t('common.next')}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CatalogPage;
