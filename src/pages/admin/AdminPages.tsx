import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import RichTextEditor from '@/components/ui/rich-text-editor';

interface Page {
  id: string;
  slug: string;
  title_ca: string | null;
  title_es: string | null;
  content_ca: string | null;
  content_es: string | null;
  is_active: boolean;
  sort_order: number;
  menu_location: 'none' | 'header' | 'footer';
  menu_order: number;
}

const AdminPages: React.FC = () => {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<Page>>({});
  const [tab, setTab] = useState<'ca' | 'es'>('ca');

  const { data: pages = [], isLoading } = useQuery({
    queryKey: ['admin-cms-pages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cms_blocks')
        .select('*')
        .eq('kind', 'page')
        .order('sort_order');
      if (error) throw error;
      return data as Page[];
    },
  });

  const select = (p: Page) => { setSelectedId(p.id); setEditing(p); };

  const newPage = () => {
    setSelectedId(null);
    setEditing({
      slug: '', title_ca: '', title_es: '', content_ca: '', content_es: '',
      is_active: true, sort_order: pages.length + 1,
      menu_location: 'footer', menu_order: pages.length + 1,
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editing.slug) throw new Error('Cal un slug');
      const payload = {
        slug: editing.slug,
        kind: 'page',
        title_ca: editing.title_ca ?? null,
        title_es: editing.title_es ?? null,
        content_ca: editing.content_ca ?? null,
        content_es: editing.content_es ?? null,
        is_active: editing.is_active ?? true,
        sort_order: editing.sort_order ?? 0,
        menu_location: editing.menu_location ?? 'none',
        menu_order: editing.menu_order ?? 0,
      };
      if (selectedId) {
        const { error } = await supabase.from('cms_blocks').update(payload).eq('id', selectedId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('cms_blocks').insert(payload).select('id').single();
        if (error) throw error;
        setSelectedId(data.id);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-cms-pages'] }); toast.success('Desat correctament'); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedId) return;
      const { error } = await supabase.from('cms_blocks').delete().eq('id', selectedId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-cms-pages'] });
      setSelectedId(null); setEditing({});
      toast.success('Pàgina eliminada');
    },
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display text-2xl font-bold">Pàgines legals i informatives</h1>
        <Button onClick={newPage} className="gap-1"><Plus className="h-4 w-4" /> Nova pàgina</Button>
      </div>

      <div className="grid md:grid-cols-[260px_1fr] gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Pàgines</CardTitle></CardHeader>
          <CardContent className="space-y-1 p-2">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {pages.map(p => (
              <button
                key={p.id}
                onClick={() => select(p)}
                className={`w-full text-left text-sm px-3 py-2 rounded-md transition-colors ${selectedId === p.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted'}`}
              >
                <div className="font-medium">{p.title_ca || p.slug}</div>
                <div className="text-xs text-muted-foreground">/{p.slug}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        {(selectedId || editing.slug !== undefined) && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Slug (URL)</Label>
                  <Input
                    value={editing.slug ?? ''}
                    onChange={e => setEditing(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
                    placeholder="ex: enviaments-devolucions"
                  />
                  <p className="text-xs text-muted-foreground mt-1">URL: /pagina/{editing.slug}</p>
                </div>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label>Ordre</Label>
                    <Input type="number" value={editing.sort_order ?? 0} onChange={e => setEditing(p => ({ ...p, sort_order: Number(e.target.value) }))} />
                  </div>
                  <div className="flex items-center gap-2 pb-2">
                    <Switch checked={editing.is_active ?? true} onCheckedChange={v => setEditing(p => ({ ...p, is_active: v }))} />
                    <span className="text-sm">Activa</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Ubicació al menú</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={editing.menu_location ?? 'none'}
                    onChange={e => setEditing(p => ({ ...p, menu_location: e.target.value as Page['menu_location'] }))}
                  >
                    <option value="none">No mostrar al menú</option>
                    <option value="header">Menú superior (capçalera)</option>
                    <option value="footer">Peu de pàgina</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    On apareixerà l'enllaç a la pàgina al frontend.
                  </p>
                </div>
                <div>
                  <Label>Ordre al menú</Label>
                  <Input
                    type="number"
                    value={editing.menu_order ?? 0}
                    onChange={e => setEditing(p => ({ ...p, menu_order: Number(e.target.value) }))}
                  />
                </div>
              </div>


              <Tabs value={tab} onValueChange={(v) => setTab(v as 'ca' | 'es')}>
                <TabsList>
                  <TabsTrigger value="ca">Català</TabsTrigger>
                  <TabsTrigger value="es">Castellano</TabsTrigger>
                </TabsList>
                <TabsContent value="ca" className="space-y-3">
                  <div>
                    <Label>Títol</Label>
                    <Input value={editing.title_ca ?? ''} onChange={e => setEditing(p => ({ ...p, title_ca: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Contingut</Label>
                    <RichTextEditor
                      value={editing.content_ca ?? ''}
                      onChange={(html) => setEditing(p => ({ ...p, content_ca: html }))}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="es" className="space-y-3">
                  <div>
                    <Label>Título</Label>
                    <Input value={editing.title_es ?? ''} onChange={e => setEditing(p => ({ ...p, title_es: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Contenido</Label>
                    <RichTextEditor
                      value={editing.content_es ?? ''}
                      onChange={(html) => setEditing(p => ({ ...p, content_es: html }))}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex gap-2 justify-between pt-3">
                {selectedId && (
                  <Button variant="destructive" onClick={() => { if (confirm('Eliminar aquesta pàgina?')) deleteMutation.mutate(); }}>
                    <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                  </Button>
                )}
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="ml-auto gap-1">
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Desar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminPages;
