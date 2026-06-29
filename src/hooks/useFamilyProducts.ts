import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FamilyProduct {
  id: string;
  sku: string;
  slug: string;
  base_price: number;
  stock_status: string;
  stock_quantity: number;
  is_active: boolean;
  default_section_id: string | null;
  has_variants: boolean;
  product_translations: { language: string; name: string }[];
  product_images: { image_url: string; is_primary: boolean }[];
  product_variants?: { stock_quantity: number; is_active: boolean }[];
}

/**
 * Fetches all active, sellable products that can appear in birth-list family pickers.
 * Excludes discontinued. Out-of-stock are returned so UI can show & disable them.
 */
export function useFamilyProducts() {
  return useQuery({
    queryKey: ['family-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, sku, slug, base_price, stock_status, stock_quantity, is_active,
          default_section_id, has_variants,
          product_translations(language, name),
          product_images(image_url, is_primary),
          product_variants(stock_quantity, is_active)
        `)
        .eq('is_active', true)
        .neq('stock_status', 'discontinued')
        .order('sku')
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as FamilyProduct[];
    },
    staleTime: 60 * 1000,
  });
}

export function productIsAvailable(p: FamilyProduct): boolean {
  if (!p.is_active) return false;
  if (p.stock_status === 'discontinued' || p.stock_status === 'out_of_stock') return false;
  // If variants exist, total variant stock matters
  if (p.has_variants && p.product_variants && p.product_variants.length > 0) {
    const total = p.product_variants
      .filter(v => v.is_active)
      .reduce((s, v) => s + (v.stock_quantity || 0), 0);
    if (p.stock_status === 'in_stock' && total <= 0) return false;
  } else if (p.stock_status === 'in_stock' && (p.stock_quantity || 0) <= 0) {
    return false;
  }
  return true; // on_order is allowed
}

export function pickProductName(p: FamilyProduct, lang: string, fallback = 'ca'): string {
  return (
    p.product_translations.find(t => t.language === lang)?.name ||
    p.product_translations.find(t => t.language === fallback)?.name ||
    p.product_translations[0]?.name ||
    p.sku
  );
}

export function primaryImage(p: FamilyProduct): string {
  const arr = p.product_images || [];
  return (arr.find(i => i.is_primary) || arr[0])?.image_url || '/placeholder.svg';
}
