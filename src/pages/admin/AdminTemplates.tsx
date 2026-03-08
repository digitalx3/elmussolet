import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Search, Package, X } from 'lucide-react';
import { toast } from 'sonner';

interface TemplateRow {
  id: string;
  slug: string;
  is_active: boolean | null;
  created_at: string;
  translations: { language: string; name: string; description: string | null }[];
  items_count: number;
}

interface FormData {
  slug: string;
  is_active: boolean;
  translations: {
    ca: { name: string; description: string };
    es: { name: string; description: string };
  };
}

const emptyForm: FormData = {
  slug: '',
  is_active: true,
  translations: {
    ca: { name: '', description: '' },
    es: { name: '', description: '' },
  },
};

// Product search & item management for a template
const TemplateItemsManager: React.FC<{ templateId: string }> = ({ templateId }) => {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const lang = i18n.language === 'es' ? 'es' : 'ca';
  const [search, setSearch] = useState('');

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ['template-items', templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('list_template_items')
        .select('id, product_id, quantity, sort_order, variant_id, products(sku, base_price, product_translations(name, language))')
        .eq('template_id', templateId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: searchResults = [], isFetching: searching } = useQuery({
    queryKey: ['product-search-template', search],
    queryFn: async () => {
      if (search.length < 2) return [];
      const { data, error } = await supabase
        .from('products')
        .select('id, sku, base_price, product_translations(name, language)')
        .eq('is_active', true)
        .limit(10);
      if (error) throw error;
      // Filter by name match client-side since we need to match translations
      return (data || []).filter(p => {
        const name = (p.product_translations as any[])?.find((t: any) => t.language === lang)?.name || p.sku;
        return name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
      });
    },
    enabled: search.length >= 2,
  });

  const addItem = useMutation({
    mutationFn: async (productId: string) => {
      const maxSort = items.reduce((max, i) => Math.max(max, (i as any).sort_order || 0), 0);
      const { error } = await supabase.from('list_template_items').insert({
        template_id: templateId,
        product_id: productId,
        quantity: 1,
        sort_order: maxSort + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template-items', templateId] });
      setSearch('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateQty = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { error } = await supabase.from('list_template_items').update({ quantity }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['template-items', templateId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('list_template_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['template-items', templateId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const existingProductIds = new Set(items.map((i: any) => i.product_id));

  return (
    <div className="space-y-4">
      {/* Search to add */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={t('admin.searchProductToAdd')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search.length >= 2 && (
          <div className="absolute z-10 mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-48 overflow-auto">
            {searching ? (
              <p className="p-3 text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : searchResults.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">{t('common.noResults')}</p>
            ) : (
              searchResults.filter(p => !existingProductIds.has(p.id)).map((p: any) => {
                const name = (p.product_translations as any[])?.find((t: any) => t.language === lang)?.name || p.sku;
                return (
                  <button
                    key={p.id}
                    className="w-full text-left px-3 py-2 hover:bg-muted flex items-center justify-between text-sm"
                    onClick={() => addItem.mutate(p.id)}
                  >
                    <span>{name} <span className="text-muted-foreground">({p.sku})</span></span>
                    <span className="text-muted-foreground">{Number(p.base_price).toFixed(2)} €</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Items list */}
      {loadingItems ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">{t('admin.noTemplateItems')}</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.templateProduct')}</TableHead>
              <TableHead className="w-24">SKU</TableHead>
              <TableHead className="w-24">{t('products.quantity')}</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item: any) => {
              const name = (item.products?.product_translations as any[])?.find((t: any) => t.language === lang)?.name || item.products?.sku || '—';
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-sm">{name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{item.products?.sku}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      className="w-20 h-8"
                      value={item.quantity || 1}
                      onChange={e => updateQty.mutate({ id: item.id, quantity: parseInt(e.target.value) || 1 })}
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => removeItem.mutate(item.id)}>
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

const AdminTemplates: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'ca';
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [itemsDialogId, setItemsDialogId] = useState<string | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['admin-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('list_templates')
        .select('id, slug, is_active, created_at, list_template_translations(language, name, description), list_template_items(id)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((t: any) => ({
        id: t.id,
        slug: t.slug,
        is_active: t.is_active,
        created_at: t.created_at,
        translations: t.list_template_translations || [],
        items_count: (t.list_template_items || []).length,
      })) as TemplateRow[];
    },
  });

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (tpl: TemplateRow) => {
    setEditId(tpl.id);
    const ca = tpl.translations.find(t => t.language === 'ca');
    const es = tpl.translations.find(t => t.language === 'es');
    setForm({
      slug: tpl.slug,
      is_active: tpl.is_active ?? true,
      translations: {
        ca: { name: ca?.name || '', description: ca?.description || '' },
        es: { name: es?.name || '', description: es?.description || '' },
      },
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editId) {
        const { error } = await supabase.from('list_templates').update({
          slug: form.slug,
          is_active: form.is_active,
        }).eq('id', editId);
        if (error) throw error;

        // Upsert translations
        for (const lang of ['ca', 'es'] as const) {
          const tr = form.translations[lang];
          const { data: existing } = await supabase
            .from('list_template_translations')
            .select('id')
            .eq('template_id', editId)
            .eq('language', lang)
            .maybeSingle();

          if (existing) {
            await supabase.from('list_template_translations').update({
              name: tr.name,
              description: tr.description || null,
            }).eq('id', existing.id);
          } else {
            await supabase.from('list_template_translations').insert({
              template_id: editId,
              language: lang,
              name: tr.name,
              description: tr.description || null,
            });
          }
        }
      } else {
        const { data: newTpl, error } = await supabase.from('list_templates').insert({
          slug: form.slug,
          is_active: form.is_active,
        }).select('id').single();
        if (error) throw error;

        for (const lang of ['ca', 'es'] as const) {
          const tr = form.translations[lang];
          await supabase.from('list_template_translations').insert({
            template_id: newTpl.id,
            language: lang,
            name: tr.name,
            description: tr.description || null,
          });
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-templates'] });
      setDialogOpen(false);
      toast.success(editId ? t('admin.templateUpdated') : t('admin.templateCreated'));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete items, translations, then template
      await supabase.from('list_template_items').delete().eq('template_id', id);
      await supabase.from('list_template_translations').delete().eq('template_id', id);
      const { error } = await supabase.from('list_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-templates'] });
      setDeleteId(null);
      toast.success(t('admin.templateDeleted'));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getName = (tpl: TemplateRow) =>
    tpl.translations.find(t => t.language === lang)?.name || tpl.slug;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">{t('admin.templates')}</h1>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> {t('admin.addTemplate')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{t('common.loading')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.templateName')}</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>{t('admin.templateProducts')}</TableHead>
              <TableHead>{t('admin.status')}</TableHead>
              <TableHead className="text-right">{t('admin.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map(tpl => (
              <TableRow key={tpl.id}>
                <TableCell className="font-medium">{getName(tpl)}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{tpl.slug}</TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => setItemsDialogId(tpl.id)}>
                    <Package className="h-3 w-3 mr-1" /> {tpl.items_count} {t('admin.templateProductsCount')}
                  </Button>
                </TableCell>
                <TableCell>
                  <Badge variant={tpl.is_active ? 'default' : 'secondary'}>
                    {tpl.is_active ? t('admin.active') : t('admin.inactive')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(tpl)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setDeleteId(tpl.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {templates.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {t('admin.noTemplates')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? t('admin.editTemplate') : t('admin.addTemplate')}</DialogTitle>
            <DialogDescription>
              {editId ? t('admin.editTemplateDesc') : t('admin.addTemplateDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Slug *</Label>
                <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="basic-newborn" />
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label>{t('admin.active')}</Label>
              </div>
            </div>

            <Tabs defaultValue="ca">
              <TabsList className="w-full">
                <TabsTrigger value="ca" className="flex-1">Català</TabsTrigger>
                <TabsTrigger value="es" className="flex-1">Español</TabsTrigger>
              </TabsList>
              {(['ca', 'es'] as const).map(l => (
                <TabsContent key={l} value={l} className="space-y-3 mt-3">
                  <div className="space-y-2">
                    <Label>{t('admin.templateName')} ({l.toUpperCase()}) *</Label>
                    <Input
                      value={form.translations[l].name}
                      onChange={e => setForm(f => ({
                        ...f,
                        translations: { ...f.translations, [l]: { ...f.translations[l], name: e.target.value } },
                      }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('admin.description')} ({l.toUpperCase()})</Label>
                    <Textarea
                      rows={3}
                      value={form.translations[l].description}
                      onChange={e => setForm(f => ({
                        ...f,
                        translations: { ...f.translations, [l]: { ...f.translations[l], description: e.target.value } },
                      }))}
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('admin.cancel')}</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.slug || !form.translations.ca.name || saveMutation.isPending}
            >
              {saveMutation.isPending ? '...' : (editId ? t('admin.save') : t('admin.create'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Products Dialog */}
      <Dialog open={!!itemsDialogId} onOpenChange={() => setItemsDialogId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{t('admin.templateProducts')}</DialogTitle>
            <DialogDescription>{t('admin.templateProductsDesc')}</DialogDescription>
          </DialogHeader>
          {itemsDialogId && <TemplateItemsManager templateId={itemsDialogId} />}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.confirmDelete')}</DialogTitle>
            <DialogDescription>{t('admin.confirmDeleteTemplateDesc')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>{t('admin.cancel')}</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? '...' : t('admin.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTemplates;
