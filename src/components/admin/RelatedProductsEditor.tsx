import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GripVertical, Plus, Trash2, Search, ShoppingBag, Check } from 'lucide-react';
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
import { useTranslation } from 'react-i18next';

interface ProductLite {
  id: string;
  slug: string;
  sku: string;
  name: string;
  image: string | null;
  category_id: string | null;
}

interface CategoryLite { id: string; name: string }

interface Props {
  productId?: string;
  value: string[];
  onChange: (ids: string[]) => void;
  title: string;
  description?: string;
}

function useProductsLite() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'ca';
  return useQuery({
    queryKey: ['admin-products-lite', lang],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, slug, sku, category_id,
          product_translations(name, language),
          product_images(image_url, is_primary, sort_order)
        `)
        .eq('is_active', true);
      if (error) throw error;
      return (data || []).map((p: any) => {
        const tr = (p.product_translations || []).find((t: any) => t.language === lang)
          || (p.product_translations || []).find((t: any) => t.language === 'ca')
          || (p.product_translations || [])[0];
        const imgs = (p.product_images || []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order);
        const primary = imgs.find((i: any) => i.is_primary) || imgs[0];
        return {
          id: p.id, slug: p.slug, sku: p.sku,
          name: tr?.name || p.slug,
          image: primary?.image_url || null,
          category_id: p.category_id ?? null,
        } as ProductLite;
      });
    },
  });
}

function useCategoriesLite() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'ca';
  return useQuery({
    queryKey: ['admin-categories-lite', lang],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, slug, category_translations(language, name)');
      if (error) throw error;
      return (data || []).map((c: any) => {
        const tr = (c.category_translations || []).find((t: any) => t.language === lang)
          || (c.category_translations || [])[0];
        return { id: c.id, name: tr?.name || c.slug } as CategoryLite;
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

const RelatedProductsEditor: React.FC<Props> = ({ productId, value, onChange, title, description }) => {
  const { data: products = [] } = useProductsLite();
  const { data: categories = [] } = useCategoriesLite();
  const [search, setSearch] = useState('');
  const [browseCategory, setBrowseCategory] = useState<string>('all');

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
  const selectedSet = useMemo(() => new Set(value), [value]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(p => p.id !== productId && !selectedSet.has(p.id))
      .filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, products, selectedSet, productId]);

  const browseList = useMemo(() => {
    return products
      .filter(p => p.id !== productId)
      .filter(p => browseCategory === 'all' ? true : p.category_id === browseCategory)
      .slice(0, 60);
  }, [products, productId, browseCategory]);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) onChange(value.filter(x => x !== id));
    else onChange([...value, id]);
  };

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
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {description && <p className="text-sm text-muted-foreground">{description}</p>}

        {/* Search */}
        <div>
          <Label>Cercar producte per nom o SKU</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Comença a escriure..."
            />
          </div>
          {searchResults.length > 0 && (
            <div className="border rounded-md mt-2 max-h-64 overflow-y-auto divide-y">
              {searchResults.map(p => (
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

        {/* Browse grid by category */}
        <div>
          <Label>O navega per categoria</Label>
          <select
            value={browseCategory}
            onChange={e => setBrowseCategory(e.target.value)}
            className="w-full mt-1 border border-input bg-background rounded-md h-9 px-2 text-sm"
          >
            <option value="all">Totes les categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {browseList.length === 0 ? (
            <p className="text-sm text-muted-foreground italic mt-3">No hi ha productes en aquesta categoria.</p>
          ) : (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[480px] overflow-y-auto pr-1">
              {browseList.map(p => {
                const isSel = selectedSet.has(p.id);
                return (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    className={`text-left border rounded-md overflow-hidden bg-card hover:shadow-sm transition-all relative ${isSel ? 'ring-2 ring-primary border-primary' : ''}`}
                  >
                    <div className="aspect-square bg-muted">
                      {p.image ? (
                        <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <ShoppingBag className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <div className="text-xs font-medium line-clamp-2">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{p.sku}</div>
                    </div>
                    {isSel && (
                      <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-1 shadow">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected list (sortable) */}
        <div>
          <Label>Seleccionats ({selected.length}) — arrossega per reordenar</Label>
          {selected.length === 0 ? (
            <p className="text-sm text-muted-foreground italic mt-2">Encara no hi ha productes seleccionats.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={value} strategy={verticalListSortingStrategy}>
                <div className="space-y-2 mt-2">
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
        </div>
      </CardContent>
    </Card>
  );
};

export default RelatedProductsEditor;
