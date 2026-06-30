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
  /** All (section, subsection) assignments — at most 3. */
  assignments: { section_id: string; subsection_id: string | null; position: number }[];
}

export interface UseFamilyProductsOptions {
  availableOnly?: boolean;
}

/**
 * Fetches products assigned to at least one birth-list family via
 * `product_default_sections`. The returned `assignments` array allows
 * the caller to surface the same product under multiple families /
 * subfamilies.
 */
export function useFamilyProducts(options: UseFamilyProductsOptions = {}) {
  const availableOnly = options.availableOnly ?? true;
  return useQuery({
    queryKey: ['family-products', { availableOnly, v: 2 }],
    queryFn: async () => {
      let q = supabase
        .from('products')
        .select(`
          id, sku, slug, base_price, stock_status, stock_quantity, is_active,
          default_section_id, has_variants,
          product_translations(language, name),
          product_images(image_url, is_primary),
          product_variants(stock_quantity, is_active),
          product_default_sections(position, section_id, subsection_id)
        `)
        .eq('is_active', true);
      if (availableOnly) {
        q = q.in('stock_status', ['in_stock', 'on_order']);
      }
      const { data, error } = await q.order('sku').limit(2000);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      return rows
        .map(r => ({
          ...r,
          assignments: (r.product_default_sections || []).map((a: any) => ({
            section_id: a.section_id,
            subsection_id: a.subsection_id ?? null,
            position: a.position,
          })),
        }))
        .filter(r => r.assignments.length > 0) as FamilyProduct[];
    },
    staleTime: 60 * 1000,
  });
}

/**
 * Per-section assignment counts (counting product-section pairs, not products),
 * used to distinguish "no products assigned" from "all out of stock".
 */
export function useFamilyAssignmentCounts() {
  return useQuery({
    queryKey: ['family-assignment-counts', { v: 2 }],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_default_sections')
        .select('section_id, products!inner(is_active)')
        .eq('products.is_active', true)
        .limit(5000);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of (data ?? []) as { section_id: string }[]) {
        counts.set(row.section_id, (counts.get(row.section_id) ?? 0) + 1);
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
    const hasUnlimited = p.product_variants.some(v => v.is_active && v.stock_quantity === -1);
    if (hasUnlimited) return true;
    const total = p.product_variants
      .filter(v => v.is_active)
      .reduce((s, v) => s + Math.max(0, v.stock_quantity || 0), 0);
    if (total <= 0) return false;
    return true;
  }
  const qty = p.stock_quantity ?? 0;
  if (qty === -1) return p.stock_status === 'on_order';
  if (qty <= 0) return false;
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
