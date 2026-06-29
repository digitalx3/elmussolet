import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { LayoutGrid, List, SlidersHorizontal, X, PackageX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';

import CatalogFilters from '@/components/catalog/CatalogFilters';
import ProductCard from '@/components/catalog/ProductCard';
import { useTranslatedProducts, type ProductFilters } from '@/hooks/useTranslatedProducts';
import { useCategories } from '@/hooks/useCategories';
import { useBrands } from '@/hooks/useBrands';
import { toAbsoluteUrl } from '@/lib/absoluteUrl';

const MAX_PRICE_DEFAULT = 10000;

const parseBrandsParam = (sp: URLSearchParams): string[] => {
  const multi = sp.getAll('brand');
  if (multi.length > 1) return multi;
  const single = sp.get('brand');
  if (!single) return [];
  return single.includes(',') ? single.split(',').filter(Boolean) : [single];
};

const CatalogPage: React.FC = () => {
  const { t } = useTranslation();
  const { categorySlug, brandSlug } = useParams<{ categorySlug?: string; brandSlug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedBrandIds, setSelectedBrandIds] = useState<string[]>(() => parseBrandsParam(searchParams));
  const [selectedAvailability, setSelectedAvailability] = useState<string | undefined>(
    searchParams.get('availability') ?? undefined
  );
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

  const hasActiveFilters = !!(categorySlug || selectedCategory || selectedBrandIds.length > 0 || selectedAvailability || search || priceRange[0] > 0 || priceRange[1] < MAX_PRICE_DEFAULT);

  // Sync URL → state when user navigates (back/forward, external links)
  const isSyncingFromUrl = useRef(false);
  useEffect(() => {
    isSyncingFromUrl.current = true;
    const urlBrands = parseBrandsParam(searchParams);
    const urlAvailability = searchParams.get('availability') ?? undefined;
    const urlSearch = searchParams.get('q') ?? '';
    setSelectedBrandIds(prev =>
      prev.length === urlBrands.length && prev.every((v, i) => v === urlBrands[i]) ? prev : urlBrands
    );
    setSelectedAvailability(prev => (prev === urlAvailability ? prev : urlAvailability));
    setSearch(prev => (prev === urlSearch ? prev : urlSearch));
    // allow next effect tick to re-enable write-back
    queueMicrotask(() => { isSyncingFromUrl.current = false; });
  }, [searchParams]);

  // When visiting /marca/:brandSlug, resolve slug → brand id and set as selected
  useEffect(() => {
    if (!brandSlug || brands.length === 0) return;
    const found = brands.find(b => b.slug === brandSlug);
    if (found) {
      setSelectedBrandIds(prev =>
        prev.length === 1 && prev[0] === found.id ? prev : [found.id]
      );
    }
  }, [brandSlug, brands]);

  // Sync state → URL whenever filters change (skip when on brand slug route)
  useEffect(() => {
    if (isSyncingFromUrl.current) return;
    if (brandSlug) return;
    const next = new URLSearchParams(searchParams);
    // brands
    next.delete('brand');
    selectedBrandIds.forEach(id => next.append('brand', id));
    // availability
    if (selectedAvailability) next.set('availability', selectedAvailability);
    else next.delete('availability');
    // search
    if (search) next.set('q', search);
    else next.delete('q');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [brandSlug, selectedBrandIds, selectedAvailability, search, searchParams, setSearchParams]);

  const clearFilters = () => {
    setSelectedCategory(undefined);
    setSelectedBrandIds([]);
    setSelectedAvailability(undefined);
    setPriceRange([0, MAX_PRICE_DEFAULT]);
    setSearch('');
    setPage(1);
    if (categorySlug || brandSlug) {
      navigate('/cataleg', { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const handleCategoryChange = (id: string | undefined) => {
    if (!id && categorySlug) {
      navigate('/catalog', { replace: true });
    } else {
      setSelectedCategory(id);
      setPage(1);
    }
  };

  const resolvedBrand = useMemo(
    () => (brandSlug ? brands.find(b => b.slug === brandSlug) : undefined),
    [brandSlug, brands]
  );
  const brandNotFound = !!brandSlug && brands.length > 0 && !resolvedBrand;

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

  // Per-route SEO head
  const siteOrigin = 'https://elmussolet.com';
  const seoTitle = resolvedBrand
    ? `${resolvedBrand.name} — ${t('products.catalog')} | El Mussolet`
    : currentCategoryName
      ? `${currentCategoryName} | El Mussolet`
      : `${t('products.catalog')} | El Mussolet`;
  const seoDescription = resolvedBrand
    ? (resolvedBrand.description?.trim() ||
        t('products.brandSeoDescription', {
          brand: resolvedBrand.name,
          defaultValue: `Descobreix tots els productes de {{brand}} a El Mussolet.`,
        }))
    : t('products.catalogSeoDescription', 'Catàleg de productes per a nadons i infants a El Mussolet.');
  const seoCanonical = resolvedBrand
    ? `${siteOrigin}/marca/${resolvedBrand.slug}`
    : categorySlug
      ? `${siteOrigin}/cataleg/${categorySlug}`
      : `${siteOrigin}/cataleg`;
  const seoImage = toAbsoluteUrl(resolvedBrand?.logoUrl, siteOrigin) || undefined;

  const breadcrumbJsonLd = resolvedBrand
    ? {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('common.backHome', 'Inici'), item: `${siteOrigin}/` },
          { '@type': 'ListItem', position: 2, name: t('products.catalog'), item: `${siteOrigin}/cataleg` },
          { '@type': 'ListItem', position: 3, name: resolvedBrand.name, item: `${siteOrigin}/marca/${resolvedBrand.slug}` },
        ],
      }
    : null;




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
      onCategoryChange={handleCategoryChange}
      onBrandIdsChange={(ids) => { setSelectedBrandIds(ids); setPage(1); }}
      onAvailabilityChange={(val) => { setSelectedAvailability(val); setPage(1); }}
      onPriceRangeChange={(range) => { setPriceRange(range); setPage(1); }}
      onSearchChange={(val) => { setSearch(val); setPage(1); }}
      onClearFilters={clearFilters}
      hasActiveFilters={hasActiveFilters}
    />
  );

  if (brandNotFound) {
    const notFoundTitle = t('products.brandNotFoundTitle', 'Marca no trobada');
    const notFoundDesc = t('products.brandNotFoundDesc', {
      slug: brandSlug,
      defaultValue: `No hem trobat cap marca amb l'identificador "{{slug}}".`,
    });
    return (
      <div className="container py-16">
        <Helmet>
          <title>{`${notFoundTitle} | El Mussolet`}</title>
          <meta name="description" content={notFoundDesc} />
          <meta name="robots" content="noindex,follow" />
          <link rel="canonical" href={`${siteOrigin}/cataleg`} />
          <meta property="og:title" content={notFoundTitle} />
          <meta property="og:description" content={notFoundDesc} />
          <meta property="og:url" content={`${siteOrigin}/cataleg`} />
          <meta property="og:type" content="website" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={notFoundTitle} />
          <meta name="twitter:description" content={notFoundDesc} />
        </Helmet>
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <PackageX className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          </div>
          <h1 className="font-display text-3xl font-bold mb-2">{notFoundTitle}</h1>
          <p className="text-muted-foreground mb-6">{notFoundDesc}</p>
          <div className="flex justify-center gap-2">
            <Button asChild>
              <Link to="/cataleg">{t('products.backToCatalog', 'Tornar al catàleg')}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/">{t('common.backHome', 'Inici')}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={seoCanonical} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:url" content={seoCanonical} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        {seoImage && <meta property="og:image" content={seoImage} />}
        {seoImage && <meta name="twitter:image" content={seoImage} />}
        {breadcrumbJsonLd && (
          <script type="application/ld+json">{JSON.stringify(breadcrumbJsonLd)}</script>
        )}
      </Helmet>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-3xl font-bold">
            {resolvedBrand?.name ?? currentCategoryName ?? t('products.catalog')}
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
