import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notify } from '@/lib/notify';
import { Star, GripVertical, Plus, Trash2, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface FeaturedItem {
  id: string;
  slug: string;
  sku: string;
  name: string;
  image: string | null;
  featured_order: number | null;
}

function useFeaturedAdmin() {
  return useQuery({
    queryKey: ['admin-featured-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, slug, sku, featured_order,
          product_translations(name, language),
          product_images(image_url, is_primary, sort_order)
        `)
        .eq('is_featured', true)
        .order('featured_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
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
          featured_order: p.featured_order ?? null,
        } as FeaturedItem;
      });
    },
  });
}

function useAvailableProducts(search: string, excludeIds: string[]) {
  return useQuery({
    queryKey: ['admin-products-search', search, excludeIds.length],
    enabled: search.trim().length > 0,
    queryFn: async () => {
      const q = search.trim();
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, slug, sku, is_featured,
          product_translations(name, language),
          product_images(image_url, is_primary, sort_order)
        `)
        .eq('is_featured', false)
        .eq('is_active', true);
      if (error) throw error;
      const ql = q.toLowerCase();
      return (data || [])
        .filter((p: any) => !excludeIds.includes(p.id))
        .map((p: any) => {
          const tr = (p.product_translations || []).find((t: any) => t.language === 'ca')
            || (p.product_translations || [])[0];
          const imgs = (p.product_images || []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order);
          const primary = imgs.find((i: any) => i.is_primary) || imgs[0];
          return {
            id: p.id, slug: p.slug, sku: p.sku,
            name: tr?.name || p.slug,
            image: primary?.image_url || null,
          };
        })
        .filter((p: any) => p.name.toLowerCase().includes(ql) || p.sku.toLowerCase().includes(ql))
        .slice(0, 10);
    },
  });
}

function SortableCard({ item, onRemove }: { item: FeaturedItem; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 border rounded-md p-2 bg-card">
      <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      {item.image ? (
        <img src={item.image} alt="" className="w-12 h-12 rounded object-cover" />
      ) : (
        <div className="w-12 h-12 rounded bg-muted" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{item.name}</div>
        <div className="text-[11px] text-muted-foreground truncate">{item.sku}</div>
      </div>
      <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={onRemove} title="Treure de destacats">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

const AdminFeaturedProducts: React.FC = () => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: featured = [], isLoading } = useFeaturedAdmin();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<FeaturedItem[] | null>(null);
  const list = items ?? featured;

  React.useEffect(() => { setItems(null); /* reset on data refetch */ }, [featured]);

  const excludeIds = useMemo(() => list.map(p => p.id), [list]);
  const { data: results = [], isFetching } = useAvailableProducts(search, excludeIds);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const setFeaturedMutation = useMutation({
    mutationFn: async (payload: { id: string; is_featured: boolean; featured_order: number | null }) => {
      const { error } = await supabase.from('products').update({
        is_featured: payload.is_featured,
        featured_order: payload.featured_order,
      }).eq('id', payload.id);
      if (error) throw error;
    },
  });

  const persistOrder = useMutation({
    mutationFn: async (ordered: FeaturedItem[]) => {
      // Update featured_order one by one
      for (let i = 0; i < ordered.length; i++) {
        const { error } = await supabase.from('products')
          .update({ featured_order: i })
          .eq('id', ordered[i].id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-featured-products'] });
      qc.invalidateQueries({ queryKey: ['featured-products'] });
      notify.success('Ordre desat');
    },
    onError: (e: any) => notify.error(e?.message || 'Error desant l\'ordre'),
  });

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = list.findIndex(p => p.id === active.id);
    const newIdx = list.findIndex(p => p.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const next = arrayMove(list, oldIdx, newIdx);
    setItems(next);
  };

  const handleAdd = async (p: { id: string; name: string }) => {
    await setFeaturedMutation.mutateAsync({
      id: p.id, is_featured: true, featured_order: list.length,
    });
    setSearch('');
    qc.invalidateQueries({ queryKey: ['admin-featured-products'] });
    qc.invalidateQueries({ queryKey: ['featured-products'] });
    notify.success(`${p.name} afegit a destacats`);
  };

  const handleRemove = async (id: string) => {
    await setFeaturedMutation.mutateAsync({ id, is_featured: false, featured_order: null });
    qc.invalidateQueries({ queryKey: ['admin-featured-products'] });
    qc.invalidateQueries({ queryKey: ['featured-products'] });
  };

  const dirty = items !== null && JSON.stringify(items.map(i => i.id)) !== JSON.stringify(featured.map(i => i.id));

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-primary fill-primary" />
          <h1 className="font-display text-2xl font-bold">Productes destacats</h1>
        </div>
        {dirty && (
          <Button onClick={() => persistOrder.mutate(list)} disabled={persistOrder.isPending}>
            {persistOrder.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Desar ordre
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Afegir producte</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca per nom o SKU..."
              className="pl-9"
            />
          </div>
          {search && (
            <div className="mt-2 border rounded-md divide-y max-h-80 overflow-y-auto">
              {isFetching && <div className="p-3 text-sm text-muted-foreground">Cercant...</div>}
              {!isFetching && results.length === 0 && <div className="p-3 text-sm text-muted-foreground">Cap resultat</div>}
              {results.map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleAdd(p)}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Llistat ordenat ({list.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregant...</p>
          ) : list.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Encara no has marcat cap producte com a destacat. Cerca'n un a sobre o activa'l des de la fitxa.
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={list.map(p => p.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {list.map(item => (
                    <SortableCard key={item.id} item={item} onRemove={() => handleRemove(item.id)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminFeaturedProducts;
