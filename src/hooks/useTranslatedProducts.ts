import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { computePrice, isSaleActive, type SalePriceType } from '@/lib/pricing';

export interface ProductFilters {
  categoryId?: string;
  brandId?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: string;
  sortBy?: 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc' | 'newest';
  page?: number;
  perPage?: number;
}

export interface TranslatedProduct {
  id: string;
  slug: string;
  sku: string;
  basePrice: number;        // pre-tax base before any sale
  priceWithTax: number;     // tax-inclusive original (no sale)
  finalPriceWithTax: number;// tax-inclusive after sale
  taxPercentage: number;
  taxName: string | null;
  onSale: boolean;
  discountPct: number;
  salePriceType: SalePriceType;
  saleValue: number | null;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  isFeatured: boolean;
  featuredOrder: number | null;
  stockQuantity: number;
  stockStatus: string;
  isActive: boolean;
  hasVariants: boolean;
  weightGrams: number;
  categoryId: string | null;
  brandId: string | null;
  brandName: string | null;
  brandLogo: string | null;
  name: string;
  shortDescription: string | null;
  description: string;
  primaryImage: string | null;
  createdAt: string;
  replacement: { id: string; slug: string; name: string; image: string | null } | null;
}

function mapProduct(p: any, translation: any, lang: string = 'ca'): TranslatedProduct {
  const images = p.product_images || [];
  const primaryImg = images.find((i: any) => i.is_primary) || images.sort((a: any, b: any) => a.sort_order - b.sort_order)[0];

  const basePrice = Number(p.base_price);
  const taxPct = (p as any).tax_rates?.percentage ?? 0;
  const taxName = (p as any).tax_rates?.name ?? null;

  const pricing = computePrice({
    basePrice,
    salePriceType: p.sale_price_type,
    saleValue: p.sale_value != null ? Number(p.sale_value) : null,
    saleStartsAt: p.sale_starts_at,
    saleEndsAt: p.sale_ends_at,
  });

  const rep = p.replacement;
  let replacement: TranslatedProduct['replacement'] = null;
  if (rep) {
    const rTrs = rep.product_translations || [];
    const rTr = rTrs.find((x: any) => x.language === lang) || rTrs[0];
    const rImgs = (rep.product_images || []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order);
    const rPrimary = rImgs.find((i: any) => i.is_primary) || rImgs[0];
    replacement = {
      id: rep.id,
      slug: (rTr as any)?.slug || rep.slug,
      name: rTr?.name || rep.slug,
      image: rPrimary?.image_url || null,
    };
  }

  return {
    id: p.id,
    slug: p.slug,
    sku: p.sku,
    basePrice,
    priceWithTax: pricing.base * (1 + taxPct / 100),
    finalPriceWithTax: pricing.final * (1 + taxPct / 100),
    taxPercentage: taxPct,
    taxName,
    onSale: pricing.onSale,
    discountPct: pricing.discountPct,
    salePriceType: p.sale_price_type ?? null,
    saleValue: p.sale_value != null ? Number(p.sale_value) : null,
    saleStartsAt: p.sale_starts_at ?? null,
    saleEndsAt: p.sale_ends_at ?? null,
    isFeatured: !!p.is_featured,
    featuredOrder: p.featured_order ?? null,
    stockQuantity: p.stock_quantity ?? 0,
    stockStatus: p.stock_status ?? 'in_stock',
    isActive: p.is_active,
    hasVariants: p.has_variants ?? false,
    weightGrams: p.weight_grams ?? 0,
    categoryId: p.category_id,
    brandId: p.brand_id,
    brandName: p.brands?.name ?? null,
    brandLogo: p.brands?.logo_url ?? null,
    name: translation?.name ?? '',
    shortDescription: translation?.short_description ?? null,
    description: translation?.description ?? '',
    primaryImage: primaryImg?.image_url ?? null,
    createdAt: p.created_at,
    replacement,
  };
}

export function useTranslatedProducts(filters: ProductFilters = {}) {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'ca';
  const page = filters.page ?? 1;
  const perPage = filters.perPage ?? 12;

  return useQuery({
    queryKey: ['products', lang, filters],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          *,
          product_translations!inner(name, short_description, description, language),
          product_images(image_url, is_primary, sort_order),
          brands(name, logo_url),
          tax_rates(id, name, percentage),
          replacement:replacement_product_id (
            id, slug,
            product_translations(name, language, slug),
            product_images(image_url, is_primary, sort_order)
          )
        `)
        .eq('is_active', true)
        .eq('product_translations.language', lang);

      if (filters.categoryId) query = query.eq('category_id', filters.categoryId);
      if (filters.brandId) query = query.eq('brand_id', filters.brandId);
      if (filters.availability) query = query.eq('stock_status', filters.availability);

      switch (filters.sortBy) {
        case 'price_asc': query = query.order('base_price', { ascending: true }); break;
        case 'price_desc': query = query.order('base_price', { ascending: false }); break;
        case 'newest': query = query.order('created_at', { ascending: false }); break;
        case 'name_asc':
        case 'name_desc':
          query = query.order('created_at', { ascending: false }); break;
        default: query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;

      let products: TranslatedProduct[] = (data || []).map((p: any) => {
        const tr = Array.isArray(p.product_translations) ? p.product_translations[0] : p.product_translations;
        return mapProduct(p, tr, lang);
      });

      if (filters.search) {
        const s = filters.search.toLowerCase();
        products = products.filter(p =>
          p.name.toLowerCase().includes(s) ||
          (p.shortDescription?.toLowerCase().includes(s))
        );
      }

      if (filters.minPrice !== undefined) {
        products = products.filter(p => p.finalPriceWithTax >= filters.minPrice!);
      }
      if (filters.maxPrice !== undefined) {
        products = products.filter(p => p.finalPriceWithTax <= filters.maxPrice!);
      }

      if (filters.sortBy === 'name_asc') products.sort((a, b) => a.name.localeCompare(b.name));
      else if (filters.sortBy === 'name_desc') products.sort((a, b) => b.name.localeCompare(a.name));

      const total = products.length;
      const start = (page - 1) * perPage;
      const paginated = products.slice(start, start + perPage);

      return { products: paginated, total, totalPages: Math.ceil(total / perPage), page };
    },
  });
}

export function useProductBySlug(slug: string | undefined) {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'ca';

  return useQuery({
    queryKey: ['product', slug, lang],
    enabled: !!slug,
    queryFn: async () => {
      const baseSelect = `
          *,
          product_translations(name, short_description, description, language, slug),
          product_images(id, image_url, alt_text, is_primary, sort_order),
          brands(name, logo_url),
          tax_rates(id, name, percentage),
          product_variants(
            id, value, price_override, price_modifier, stock_quantity, sku_suffix, is_active,
            variant_types(slug, variant_type_translations(name, language))
          ),
          replacement:replacement_product_id (
            id, slug,
            product_translations(name, language, slug),
            product_images(image_url, is_primary, sort_order)
          )
        `;


      // 1) Try base slug
      let { data, error } = await supabase
        .from('products')
        .select(baseSelect)
        .eq('slug', slug!)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;

      // 2) Fallback: resolve via translated slug
      if (!data) {
        const { data: tr, error: trErr } = await supabase
          .from('product_translations')
          .select('product_id')
          .eq('slug', slug!)
          .limit(1)
          .maybeSingle();
        if (trErr) throw trErr;
        if (tr?.product_id) {
          const { data: p2, error: p2Err } = await supabase
            .from('products')
            .select(baseSelect)
            .eq('id', tr.product_id)
            .eq('is_active', true)
            .maybeSingle();
          if (p2Err) throw p2Err;
          data = p2;
        }
      }

      if (!data) return null;


      const translations = data.product_translations || [];
      const t = (translations as any[]).find((t: any) => t.language === lang) || (translations as any[])[0];
      const images = ((data.product_images || []) as any[]).sort((a: any, b: any) => a.sort_order - b.sort_order);
      const variants = ((data.product_variants || []) as any[])
        .filter((v: any) => v.is_active)
        .map((v: any) => {
          const vtTranslations = v.variant_types?.variant_type_translations || [];
          const vtName = vtTranslations.find((vt: any) => vt.language === lang)?.name
            || vtTranslations[0]?.name
            || v.variant_types?.slug || '';
          return {
            id: v.id,
            value: v.value,
            priceOverride: v.price_override != null ? Number(v.price_override) : null,
            priceModifier: v.price_modifier != null ? Number(v.price_modifier) : 0,
            stockQuantity: v.stock_quantity ?? 0,
            skuSuffix: v.sku_suffix,
            typeName: vtName,
            typeSlug: v.variant_types?.slug || '',
          };
        });

      const basePrice = Number(data.base_price);
      const taxPct = (data as any).tax_rates?.percentage ?? 0;
      const taxName = (data as any).tax_rates?.name ?? null;
      const saleActive = isSaleActive(
        (data as any).sale_price_type,
        (data as any).sale_value,
        (data as any).sale_starts_at,
        (data as any).sale_ends_at,
      );

      const rep = (data as any).replacement;
      let replacement: { id: string; slug: string; name: string; image: string | null } | null = null;
      if (rep) {
        const rTrs = rep.product_translations || [];
        const rTr = rTrs.find((x: any) => x.language === lang) || rTrs[0];
        const rImgs = (rep.product_images || []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order);
        const rPrimary = rImgs.find((i: any) => i.is_primary) || rImgs[0];
        const localizedSlug = (rTr as any)?.slug || rep.slug;
        replacement = {
          id: rep.id,
          slug: localizedSlug,
          name: rTr?.name || rep.slug,
          image: rPrimary?.image_url || null,
        };
      }

      return {
        id: data.id,
        slug: data.slug,
        sku: data.sku,
        basePrice,
        priceWithTax: basePrice * (1 + taxPct / 100),
        taxPercentage: taxPct,
        taxName,
        salePriceType: (data as any).sale_price_type ?? null,
        saleValue: (data as any).sale_value != null ? Number((data as any).sale_value) : null,
        saleStartsAt: (data as any).sale_starts_at ?? null,
        saleEndsAt: (data as any).sale_ends_at ?? null,
        saleActive,
        isFeatured: !!(data as any).is_featured,
        stockQuantity: data.stock_quantity ?? 0,
        stockStatus: data.stock_status ?? 'in_stock',
        hasVariants: data.has_variants ?? false,
        weightGrams: data.weight_grams ?? 0,
        categoryId: data.category_id,
        brandId: data.brand_id,
        brandName: (data.brands as any)?.name ?? null,
        brandLogo: (data.brands as any)?.logo_url ?? null,
        name: t?.name ?? '',
        shortDescription: t?.short_description ?? null,
        description: t?.description ?? '',
        images,
        variants,
        replacement,
      };

    },
  });
}

// Featured products for the home page (translated, ordered).
export function useFeaturedProducts(limit: number = 8) {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'ca';

  return useQuery({
    queryKey: ['featured-products', lang, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_translations!inner(name, short_description, description, language),
          product_images(image_url, is_primary, sort_order),
          brands(name, logo_url),
          tax_rates(id, name, percentage),
          replacement:replacement_product_id (
            id, slug,
            product_translations(name, language, slug),
            product_images(image_url, is_primary, sort_order)
          )
        `)
        .eq('is_active', true)
        .eq('is_featured', true)
        .eq('product_translations.language', lang)
        .order('featured_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return ((data || []) as any[]).map(p => {
        const tr = Array.isArray(p.product_translations) ? p.product_translations[0] : p.product_translations;
        return mapProduct(p, tr, lang);
      });
    },
  });
}

// Active sale products for the home page (translated, ordered by discount).
export function useSaleProducts(limit: number = 24) {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'ca';

  return useQuery({
    queryKey: ['sale-products', lang, limit],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_translations!inner(name, short_description, description, language),
          product_images(image_url, is_primary, sort_order),
          brands(name, logo_url),
          tax_rates(id, name, percentage),
          replacement:replacement_product_id (
            id, slug,
            product_translations(name, language, slug),
            product_images(image_url, is_primary, sort_order)
          )
        `)
        .eq('is_active', true)
        .eq('is_featured', false)
        .not('sale_price_type', 'is', null)
        .not('sale_value', 'is', null)
        .gt('sale_value', 0)
        .or(`sale_starts_at.is.null,sale_starts_at.lte.${nowIso}`)
        .or(`sale_ends_at.is.null,sale_ends_at.gte.${nowIso}`)
        .eq('product_translations.language', lang)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      const mapped = ((data || []) as any[]).map(p => {
        const tr = Array.isArray(p.product_translations) ? p.product_translations[0] : p.product_translations;
        return mapProduct(p, tr, lang);
      });
      // Defensive: only keep those whose sale is actually active.
      return mapped.filter(p => p.onSale).sort((a, b) => b.discountPct - a.discountPct);
    },
  });
}

// Internal: fetch related products by relation type, preserving admin-defined order.
function useRelationsByType(productId: string | undefined, relationType: 'upsell' | 'cross_sell', queryKey: string) {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'ca';

  return useQuery({
    queryKey: [queryKey, productId, lang],
    enabled: !!productId,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      const { data: rels, error: relErr } = await supabase
        .from('product_relations')
        .select('related_product_id, position, relation_type')
        .eq('product_id', productId!)
        .eq('relation_type', relationType)
        .order('position', { ascending: true });
      if (relErr) throw relErr;
      const ids = (rels ?? []).map((r: any) => r.related_product_id);
      if (ids.length === 0) return [] as TranslatedProduct[];

      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_translations!inner(name, short_description, description, language),
          product_images(image_url, is_primary, sort_order),
          brands(name, logo_url),
          tax_rates(id, name, percentage),
          replacement:replacement_product_id (
            id, slug,
            product_translations(name, language, slug),
            product_images(image_url, is_primary, sort_order)
          )
        `)
        .in('id', ids)
        .eq('is_active', true)
        .eq('product_translations.language', lang);
      if (error) throw error;

      const byId = new Map<string, TranslatedProduct>();
      (data || []).forEach((p: any) => {
        const tr = Array.isArray(p.product_translations) ? p.product_translations[0] : p.product_translations;
        byId.set(p.id, mapProduct(p, tr, lang));
      });
      return ids.map(id => byId.get(id)).filter(Boolean) as TranslatedProduct[];
    },
  });
}

// Up-sell products (shown in product page + cart pop-up).
export function useRelatedProducts(productId: string | undefined) {
  return useRelationsByType(productId, 'upsell', 'related-products');
}

// Cross-sell products (shown only in product page, never in pop-up).
export function useCrossSellProducts(productId: string | undefined) {
  return useRelationsByType(productId, 'cross_sell', 'cross-sell-products');
}
