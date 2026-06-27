import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

interface ProductLite {
  id: string;
  slug: string;
  sku: string;
  name: string;
  image: string | null;
}

interface Props {
  excludeId?: string;
  value: string | null;
  onChange: (id: string | null) => void;
}

function useProductsLite() {
  return useQuery({
    queryKey: ['admin-products-lite-replacement'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, slug, sku,
          product_translations(name, language),
          product_images(image_url, is_primary, sort_order)
        `)
        .eq('is_active', true);
      if (error) throw error;
      return (data || []).map((p: any) => {
        const tr = (p.product_translations || []).find((t: any) => t.language === 'ca')
          || (p.product_translations || [])[0];
        const imgs = (p.product_images || []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order);
        const primary = imgs.find((i: any) => i.is_primary) || imgs[0];
        return {
          id: p.id, slug: p.slug, sku: p.sku,
          name: tr?.name || p.slug,
          image: primary?.image_url || null,
        } as ProductLite;
      });
    },
  });
}

const ReplacementProductPicker: React.FC<Props> = ({ excludeId, value, onChange }) => {
  const { data: products = [] } = useProductsLite();
  const [search, setSearch] = useState('');

  const byId = useMemo(() => {
    const m = new Map<string, ProductLite>();
    products.forEach(p => m.set(p.id, p));
    return m;
  }, [products]);

  const selected = value ? byId.get(value) : undefined;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(p => p.id !== excludeId && p.id !== value)
      .filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, products, value, excludeId]);

  return (
    <div className="space-y-2 rounded-md border border-dashed border-border bg-muted/30 p-3">
      <Label className="text-sm font-medium">Producte que el substitueix</Label>
      <p className="text-xs text-muted-foreground">
        Cerca pel nom o SKU del producte que reemplaça aquest producte descatalogat.
      </p>

      {selected ? (
        <div className="flex items-center gap-3 rounded-md border bg-background p-2">
          {selected.image ? (
            <img src={selected.image} alt="" className="h-10 w-10 rounded object-cover" />
          ) : (
            <div className="h-10 w-10 rounded bg-muted" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{selected.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">{selected.sku}</div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={() => onChange(null)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <>
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Comença a escriure el nom o SKU..."
          />
          {filtered.length > 0 && (
            <div className="max-h-64 overflow-y-auto divide-y rounded-md border bg-background">
              {filtered.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { onChange(p.id); setSearch(''); }}
                  className="flex w-full items-center gap-3 p-2 text-left hover:bg-muted"
                >
                  {p.image
                    ? <img src={p.image} alt="" className="h-8 w-8 rounded object-cover" />
                    : <div className="h-8 w-8 rounded bg-muted" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{p.sku}</div>
                  </div>
                  <Plus className="h-4 w-4 text-primary" />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReplacementProductPicker;
