import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/lib/notify';

export interface AdminProduct {
  id: string;
  slug: string;
  sku: string;
  base_price: number;
  stock_quantity: number;
  stock_status: string;
  is_active: boolean;
  has_variants: boolean;
  weight_grams: number;
  category_id: string | null;
  brand_id: string | null;
  created_at: string;
  sale_price_type: 'fixed' | 'percent' | null;
  sale_value: number | null;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  is_featured: boolean;
  featured_order: number | null;
  replacement_product_id: string | null;
  product_translations: { language: string; name: string; short_description: string | null; description: string; slug: string | null }[];
  product_images: { id: string; image_url: string; alt_text: string | null; is_primary: boolean; sort_order: number }[];
  brands: { name: string } | null;
  categories: { slug: string } | null;
  product_variants: {
    id: string; value: string; price_override: number | null; price_modifier: number | null;
    stock_quantity: number; sku_suffix: string | null; is_active: boolean;
    variant_type_id: string;
    variant_types: { slug: string } | null;
  }[];
  product_relations?: { related_product_id: string; position: number; relation_type: string }[];
}

export function useAdminProducts() {
  return useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_translations(language, name, short_description, description, slug),
          product_images(id, image_url, alt_text, is_primary, sort_order),
          brands(name),
          categories(slug),
          product_variants(id, value, price_override, price_modifier, stock_quantity, sku_suffix, is_active, variant_type_id, variant_types(slug))
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as AdminProduct[];
    },
  });
}

export function useAdminProduct(id: string | undefined) {
  return useQuery({
    queryKey: ['admin-product', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_translations(id, language, name, short_description, description, slug),
          product_images(id, image_url, alt_text, is_primary, sort_order),
          product_variants(id, value, price_override, price_modifier, stock_quantity, sku_suffix, is_active, variant_type_id, variant_types(id, slug)),
          product_relations!product_relations_product_id_fkey(related_product_id, position, relation_type)
        `)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as AdminProduct;
    },
  });
}

export interface ProductFormData {
  slug: string;
  sku: string;
  base_price: number;
  stock_quantity: number;
  stock_status: string;
  is_active: boolean;
  has_variants: boolean;
  weight_grams: number;
  category_id: string | null;
  brand_id: string | null;
  tax_rate_id: string | null;
  sale_price_type: 'fixed' | 'percent' | null;
  sale_value: number | null;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  is_featured: boolean;
  featured_order: number | null;
  replacement_product_id: string | null;
  translations: Record<string, { name: string; short_description: string; description: string; slug?: string }>;
  images: { id?: string; image_url: string; alt_text: string; is_primary: boolean; sort_order: number }[];
  variants: {
    id?: string; value: string; price_override: number | null; price_modifier: number;
    stock_quantity: number; sku_suffix: string; is_active: boolean;
    variant_type_id: string;
  }[];
  related_product_ids: string[]; // ordered upsell
  cross_sell_product_ids: string[]; // ordered cross-sell
}

export function useSaveProduct() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: ProductFormData }) => {
      const { slugify } = await import('@/lib/slug');
      // Determine a fallback base slug from any translation name if user left it blank.
      const fallbackSlug = (() => {
        if (data.slug?.trim()) return slugify(data.slug);
        const firstName = Object.values(data.translations).find((t) => t?.name?.trim())?.name;
        return slugify(firstName ?? '') || `product-${Date.now()}`;
      })();

      const productPayload = {
        slug: fallbackSlug,
        sku: data.sku,
        base_price: data.base_price,
        stock_quantity: data.stock_quantity,
        stock_status: data.stock_status,
        is_active: data.is_active,
        has_variants: data.has_variants,
        weight_grams: data.weight_grams,
        category_id: data.category_id || null,
        brand_id: data.brand_id || null,
        tax_rate_id: data.tax_rate_id || null,
        sale_price_type: data.sale_price_type || null,
        sale_value: data.sale_value ?? null,
        sale_starts_at: data.sale_starts_at || null,
        sale_ends_at: data.sale_ends_at || null,
        is_featured: !!data.is_featured,
        featured_order: data.featured_order ?? null,
        replacement_product_id: data.stock_status === 'discontinued' ? (data.replacement_product_id || null) : null,
      };


      let productId = id;

      if (id) {
        const { error } = await supabase.from('products').update(productPayload).eq('id', id);
        if (error) throw error;
      } else {
        const { data: newProduct, error } = await supabase.from('products').insert(productPayload).select('id').single();
        if (error) throw error;
        productId = newProduct.id;
      }

      // Translations
      for (const lang of Object.keys(data.translations)) {

        const tr = data.translations[lang];
        if (!tr) continue;
        await supabase.from('product_translations').delete().eq('product_id', productId!).eq('language', lang);
        if (!tr.name?.trim()) continue;
        // Per-language slug: keep manual value or auto-generate from name
        const trSlug = (tr.slug && tr.slug.trim()) ? slugify(tr.slug) : slugify(tr.name);
        const { error } = await supabase.from('product_translations').insert({
          product_id: productId!,
          language: lang,
          name: tr.name,
          short_description: tr.short_description || null,
          description: tr.description || '',
          slug: trSlug || null,
        });
        if (error) throw error;
      }


      // Images
      await supabase.from('product_images').delete().eq('product_id', productId!);
      if (data.images.length > 0) {
        const imgPayload = data.images.map((img, i) => ({
          product_id: productId!,
          image_url: img.image_url,
          alt_text: img.alt_text || null,
          is_primary: img.is_primary,
          sort_order: i,
        }));
        const { error } = await supabase.from('product_images').insert(imgPayload);
        if (error) throw error;
      }

      // Variants
      if (data.has_variants) {
        const existingIds = data.variants.filter(v => v.id).map(v => v.id!);
        if (existingIds.length > 0) {
          await supabase.from('product_variants').delete().eq('product_id', productId!).not('id', 'in', `(${existingIds.join(',')})`);
        } else {
          await supabase.from('product_variants').delete().eq('product_id', productId!);
        }

        for (const v of data.variants) {
          const variantPayload = {
            product_id: productId!,
            value: v.value,
            price_override: v.price_override,
            price_modifier: v.price_modifier ?? 0,
            stock_quantity: v.stock_quantity,
            sku_suffix: v.sku_suffix || null,
            is_active: v.is_active,
            variant_type_id: v.variant_type_id,
          };
          if (v.id) {
            await supabase.from('product_variants').update(variantPayload).eq('id', v.id);
          } else {
            await supabase.from('product_variants').insert(variantPayload);
          }
        }
      } else {
        await supabase.from('product_variants').delete().eq('product_id', productId!);
      }

      // Related products — replace both upsell and cross-sell
      await supabase.from('product_relations').delete().eq('product_id', productId!);
      const relPayload: { product_id: string; related_product_id: string; position: number; relation_type: string }[] = [];
      data.related_product_ids
        .filter(rid => rid && rid !== productId)
        .forEach((rid, i) => relPayload.push({
          product_id: productId!, related_product_id: rid, position: i, relation_type: 'upsell',
        }));
      data.cross_sell_product_ids
        .filter(rid => rid && rid !== productId)
        .forEach((rid, i) => relPayload.push({
          product_id: productId!, related_product_id: rid, position: i, relation_type: 'cross_sell',
        }));
      if (relPayload.length > 0) {
        const { error } = await supabase.from('product_relations').insert(relPayload);
        if (error) throw error;
      }

      return productId;
    },
    onSuccess: (productId) => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['admin-product'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['featured-products'] });
      // Invalidate relation caches across all languages for this product
      qc.invalidateQueries({ queryKey: ['related-products'], exact: false });
      qc.invalidateQueries({ queryKey: ['cross-sell-products'], exact: false });
      // Also remove any cached entries scoped to this productId to force a fresh fetch
      if (productId) {
        qc.removeQueries({ predicate: (q) => {
          const k = q.queryKey;
          return Array.isArray(k)
            && (k[0] === 'related-products' || k[0] === 'cross-sell-products')
            && k[1] === productId;
        }});
      }
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('product_images').delete().eq('product_id', id);
      await supabase.from('product_translations').delete().eq('product_id', id);
      await supabase.from('product_variants').delete().eq('product_id', id);
      await supabase.from('product_relations').delete().eq('product_id', id);
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      notify.success('Producte eliminat');
    },
  });
}

export function useVariantTypes() {
  return useQuery({
    queryKey: ['variant-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('variant_types')
        .select('id, slug, variant_type_translations(name, language)');
      if (error) throw error;
      return data as any[];
    },
  });
}
