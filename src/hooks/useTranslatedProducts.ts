import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';

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
  basePrice: number;
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
}

export function useTranslatedProducts(filters: ProductFilters = {}) {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'ca';
  const page = filters.page ?? 1;
  const perPage = filters.perPage ?? 12;

  return useQuery({
    queryKey: ['products', lang, filters],
    queryFn: async () => {
      // Build query
      let query = supabase
        .from('products')
        .select(`
          *,
          product_translations!inner(name, short_description, description, language),
          product_images(image_url, is_primary, sort_order),
          brands(name, logo_url)
        `)
        .eq('is_active', true)
        .eq('product_translations.language', lang);

      if (filters.categoryId) {
        query = query.eq('category_id', filters.categoryId);
      }
      if (filters.brandId) {
        query = query.eq('brand_id', filters.brandId);
      }
      if (filters.availability) {
        query = query.eq('stock_status', filters.availability);
      }
      if (filters.minPrice !== undefined) {
        query = query.gte('base_price', filters.minPrice);
      }
      if (filters.maxPrice !== undefined) {
        query = query.lte('base_price', filters.maxPrice);
      }

      // Sorting
      switch (filters.sortBy) {
        case 'price_asc':
          query = query.order('base_price', { ascending: true });
          break;
        case 'price_desc':
          query = query.order('base_price', { ascending: false });
          break;
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        case 'name_asc':
        case 'name_desc':
          // Will sort client-side by translated name
          query = query.order('created_at', { ascending: false });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      const { data, error } = await query;
      if (error) throw error;

      let products: TranslatedProduct[] = (data || []).map((p: any) => {
        const translation = Array.isArray(p.product_translations)
          ? p.product_translations[0]
          : p.product_translations;
        const images = p.product_images || [];
        const primaryImg = images.find((i: any) => i.is_primary) || images.sort((a: any, b: any) => a.sort_order - b.sort_order)[0];

        return {
          id: p.id,
          slug: p.slug,
          sku: p.sku,
          basePrice: Number(p.base_price),
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
        };
      });

      // Client-side text search on translated name
      if (filters.search) {
        const s = filters.search.toLowerCase();
        products = products.filter(p =>
          p.name.toLowerCase().includes(s) ||
          (p.shortDescription?.toLowerCase().includes(s))
        );
      }

      // Client-side name sort
      if (filters.sortBy === 'name_asc') {
        products.sort((a, b) => a.name.localeCompare(b.name));
      } else if (filters.sortBy === 'name_desc') {
        products.sort((a, b) => b.name.localeCompare(a.name));
      }

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
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_translations(name, short_description, description, language),
          product_images(id, image_url, alt_text, is_primary, sort_order),
          brands(name, logo_url),
          product_variants(
            id, value, price_override, stock_quantity, sku_suffix, is_active,
            variant_types(slug, variant_type_translations(name, language))
          )
        `)
        .eq('slug', slug!)
        .eq('is_active', true)
        .single();

      if (error) throw error;
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
            priceOverride: v.price_override ? Number(v.price_override) : null,
            stockQuantity: v.stock_quantity ?? 0,
            skuSuffix: v.sku_suffix,
            typeName: vtName,
            typeSlug: v.variant_types?.slug || '',
          };
        });

      return {
        id: data.id,
        slug: data.slug,
        sku: data.sku,
        basePrice: Number(data.base_price),
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
      };
    },
  });
}
