import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
  product_translations: { language: string; name: string; short_description: string | null; description: string }[];
  product_images: { id: string; image_url: string; alt_text: string | null; is_primary: boolean; sort_order: number }[];
  brands: { name: string } | null;
  categories: { slug: string } | null;
  product_variants: {
    id: string; value: string; price_override: number | null;
    stock_quantity: number; sku_suffix: string | null; is_active: boolean;
    variant_type_id: string;
    variant_types: { slug: string } | null;
  }[];
}

export function useAdminProducts() {
  return useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_translations(language, name, short_description, description),
          product_images(id, image_url, alt_text, is_primary, sort_order),
          brands(name),
          categories(slug),
          product_variants(id, value, price_override, stock_quantity, sku_suffix, is_active, variant_type_id, variant_types(slug))
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
          product_translations(id, language, name, short_description, description),
          product_images(id, image_url, alt_text, is_primary, sort_order),
          product_variants(id, value, price_override, stock_quantity, sku_suffix, is_active, variant_type_id, variant_types(id, slug))
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
  translations: {
    ca: { name: string; short_description: string; description: string };
    es: { name: string; short_description: string; description: string };
  };
  images: { id?: string; image_url: string; alt_text: string; is_primary: boolean; sort_order: number }[];
  variants: {
    id?: string; value: string; price_override: number | null;
    stock_quantity: number; sku_suffix: string; is_active: boolean;
    variant_type_id: string;
  }[];
}

export function useSaveProduct() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: ProductFormData }) => {
      // Upsert product
      const productPayload = {
        slug: data.slug,
        sku: data.sku,
        base_price: data.base_price,
        stock_quantity: data.stock_quantity,
        stock_status: data.stock_status,
        is_active: data.is_active,
        has_variants: data.has_variants,
        weight_grams: data.weight_grams,
        category_id: data.category_id || null,
        brand_id: data.brand_id || null,
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

      // Upsert translations
      for (const lang of ['ca', 'es'] as const) {
        const t = data.translations[lang];
        // Delete existing then insert
        await supabase.from('product_translations').delete().eq('product_id', productId!).eq('language', lang);
        const { error } = await supabase.from('product_translations').insert({
          product_id: productId!,
          language: lang,
          name: t.name,
          short_description: t.short_description || null,
          description: t.description,
        });
        if (error) throw error;
      }

      // Sync images
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

      // Sync variants
      if (data.has_variants) {
        // Delete old variants not in new list
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

      return productId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      qc.invalidateQueries({ queryKey: ['admin-product'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Delete related data first
      await supabase.from('product_images').delete().eq('product_id', id);
      await supabase.from('product_translations').delete().eq('product_id', id);
      await supabase.from('product_variants').delete().eq('product_id', id);
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-products'] });
      toast.success('Producte eliminat');
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
