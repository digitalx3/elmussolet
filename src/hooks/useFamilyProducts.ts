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

export interface UseFamilyProductsOptions {
  /**
   * When true (default) the DB query already filters by stock_status
   * IN ('in_stock','on_order'), is_active = true and
   * default_section_id NOT NULL — so the client receives only the
   * products that should be selectable.
   */
  availableOnly?: boolean;
}

/**
 * Fetches products assigned to a birth-list family (default_section_id).
 * By default the filtering by family assignment and availability state
 * (in_stock / on_order) happens at the DB level. Pass
 * `availableOnly: false` to receive every assigned product regardless of
 * stock status (useful for diagnostics or counters).
 */
export function useFamilyProducts(options: UseFamilyProductsOptions = {}) {
  const availableOnly = options.availableOnly ?? true;
  return useQuery({
    queryKey: ['family-products', { availableOnly }],
    queryFn: async () => {
      let q = supabase
        .from('products')
        .select(`
          id, sku, slug, base_price, stock_status, stock_quantity, is_active,
          default_section_id, has_variants,
          product_translations(language, name),
          product_images(image_url, is_primary),
          product_variants(stock_quantity, is_active)
        `)
        .eq('is_active', true)
        .not('default_section_id', 'is', null);
      if (availableOnly) {
        // Broad DB filter; the precise rule (on_order with stock=0 is excluded,
        // stock=-1 is unlimited) is enforced in productIsAvailable.
        q = q.in('stock_status', ['in_stock', 'on_order']);
      }
      const { data, error } = await q.order('sku').limit(2000);
      if (error) throw error;
      return (data ?? []) as unknown as FamilyProduct[];
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Lightweight per-section assignment counts (all assigned, regardless of
 * stock status). Used by the selector to distinguish "no products
 * assigned to this family" from "all products are out of stock".
 * Filtering is performed at the DB level.
 */
export function useFamilyAssignmentCounts() {
  return useQuery({
    queryKey: ['family-assignment-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('default_section_id')
        .eq('is_active', true)
        .not('default_section_id', 'is', null)
        .limit(5000);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of (data ?? []) as { default_section_id: string }[]) {
        counts.set(row.default_section_id, (counts.get(row.default_section_id) ?? 0) + 1);
      }
      return counts;
    },
    staleTime: 60 * 1000,
  });
}

export function productIsAvailable(p: FamilyProduct): boolean {
  if (!p.is_active) return false;
  if (p.stock_status === 'discontinued' || p.stock_status === 'out_of_stock') return false;
  if (p.has_variants && p.product_variants && p.product_variants.length > 0) {
    // Unlimited variants: any active variant with stock = -1
    const hasUnlimited = p.product_variants.some(v => v.is_active && v.stock_quantity === -1);
    if (hasUnlimited) return true;
    const total = p.product_variants
      .filter(v => v.is_active)
      .reduce((s, v) => s + Math.max(0, v.stock_quantity || 0), 0);
    if (total <= 0) return false;
    return true;
  }
  // Non-variant products
  const qty = p.stock_quantity ?? 0;
  if (qty === -1) {
    // Unlimited only makes sense for on_order; treat as available
    return p.stock_status === 'on_order';
  }
  if (qty <= 0) return false; // includes on_order with 0 stock — cannot be ordered
  return true;
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
