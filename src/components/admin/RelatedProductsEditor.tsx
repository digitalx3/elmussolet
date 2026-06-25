import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ProductLite {
  id: string;
  slug: string;
  sku: string;
  name: string;
  image: string | null;
}

interface Props {
  productId?: string;
  value: string[];
  onChange: (ids: string[]) => void;
}

function useProductsLite() {
  return useQuery({
    queryKey: ['admin-products-lite'],
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

function SortableRow({ p, onRemove }: { p: ProductLite; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 border rounded-md p-2 bg-card">
      <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      {p.image ? (
        <img src={p.image} alt="" className="w-10 h-10 rounded object-cover" />
      ) : (
        <div className="w-10 h-10 rounded bg-muted" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{p.name}</div>
        <div className="text-[11px] text-muted-foreground truncate">{p.sku}</div>
      </div>
      <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={onRemove}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

const RelatedProductsEditor: React.FC<Props> = ({ productId, value, onChange }) => {
  const { data: products = [] } = useProductsLite();
  const [search, setSearch] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const byId = useMemo(() => {
    const m = new Map<string, ProductLite>();
    products.forEach(p => m.set(p.id, p));
    return m;
  }, [products]);

  const selected = useMemo(() => value.map(id => byId.get(id)).filter(Boolean) as ProductLite[], [value, byId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(p => p.id !== productId && !value.includes(p.id))
      .filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, products, value, productId]);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = value.indexOf(String(active.id));
    const newIdx = value.indexOf(String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    onChange(arrayMove(value, oldIdx, newIdx));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Productes relacionats (upsell)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Es mostraran a la fitxa del producte i en un pop-up quan el client l'afegeixi a la cistella.
        </p>
        <div>
          <Label>Cercar producte per nom o SKU</Label>
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Comença a escriure..." />
          {filtered.length > 0 && (
            <div className="border rounded-md mt-2 max-h-64 overflow-y-auto divide-y">
              {filtered.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { onChange([...value, p.id]); setSearch(''); }}
                  className="w-full flex items-center gap-3 p-2 hover:bg-muted text-left"
                >
                  {p.image ? <img src={p.image} className="w-8 h-8 rounded object-cover" alt="" />
                    : <div className="w-8 h-8 rounded bg-muted" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{p.sku}</div>
                  </div>
                  <Plus className="h-4 w-4 text-primary" />
                </button>
              ))}
            </div>
          )}
        </div>

        {selected.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Encara no hi ha productes relacionats.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={value} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {selected.map(p => (
                  <SortableRow
                    key={p.id}
                    p={p}
                    onRemove={() => onChange(value.filter(x => x !== p.id))}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
};

export default RelatedProductsEditor;
