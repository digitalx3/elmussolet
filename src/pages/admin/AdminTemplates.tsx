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

// Section + visual product picker for a template
const TemplateItemsManager: React.FC<{ templateId: string }> = ({ templateId }) => {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const lang = i18n.language === 'es' ? 'es' : 'ca';
  const [search, setSearch] = useState('');
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [newSectionName, setNewSectionName] = useState('');

  // Sections of this template
  const { data: sections = [] } = useQuery({
    queryKey: ['template-sections', templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('list_template_sections')
        .select('id, name_ca, name_es, sort_order')
        .eq('template_id', templateId)
        .order('sort_order');
      if (error) throw error;
      return data || [];
    },
  });

  // Items of this template
  const { data: items = [] } = useQuery({
    queryKey: ['template-items', templateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('list_template_items')
        .select('id, product_id, quantity, sort_order, section_id')
        .eq('template_id', templateId);
      if (error) throw error;
      return data || [];
    },
  });

  // All active products (for the visual picker)
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ['admin-template-product-pool'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id, sku, base_price,
          product_translations(name, language),
          product_images(image_url, is_primary)
        `)
        .eq('is_active', true)
        .order('sku')
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  // Default active section
  React.useEffect(() => {
    if (!activeSectionId && sections.length > 0) setActiveSectionId(sections[0].id);
  }, [sections, activeSectionId]);

  // ---- Section mutations ----
  const createSection = useMutation({
    mutationFn: async (name: string) => {
      const maxSort = sections.reduce((m, s: any) => Math.max(m, s.sort_order || 0), 0);
      const { data, error } = await supabase.from('list_template_sections')
        .insert({ template_id: templateId, name_ca: name, sort_order: maxSort + 1 })
        .select('id').single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ['template-sections', templateId] });
      setActiveSectionId(id);
      setNewSectionName('');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateSection = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from('list_template_sections').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['template-sections', templateId] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteSection = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('list_template_items').delete().eq('section_id', id);
      const { error } = await supabase.from('list_template_sections').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['template-sections', templateId] });
      qc.invalidateQueries({ queryKey: ['template-items', templateId] });
      setActiveSectionId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const moveSection = (id: string, dir: -1 | 1) => {
    const idx = sections.findIndex((s: any) => s.id === id);
    const swap = sections[idx + dir];
    if (!swap) return;
    const a = sections[idx] as any;
    updateSection.mutate({ id: a.id, patch: { sort_order: (swap as any).sort_order } });
    updateSection.mutate({ id: (swap as any).id, patch: { sort_order: a.sort_order } });
  };

  // ---- Item mutations ----
  const addItem = useMutation({
    mutationFn: async (productId: string) => {
      if (!activeSectionId) throw new Error(t('admin.pickSectionFirst') as string);
      const sectionItems = items.filter((i: any) => i.section_id === activeSectionId);
      const maxSort = sectionItems.reduce((m: number, i: any) => Math.max(m, i.sort_order || 0), 0);
      const { error } = await supabase.from('list_template_items').insert({
        template_id: templateId,
        product_id: productId,
        section_id: activeSectionId,
        quantity: 1,
        sort_order: maxSort + 1,
      });
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

  const updateQty = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const { error } = await supabase.from('list_template_items').update({ quantity }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['template-items', templateId] }),
    onError: (e: any) => toast.error(e.message),
  });

  // Helpers
  const nameOf = (p: any) =>
    (p.product_translations as any[])?.find((x: any) => x.language === lang)?.name || p.sku;
  const imgOf = (p: any) => {
    const arr = (p.product_images as any[]) || [];
    return (arr.find(i => i.is_primary) || arr[0])?.image_url || '/placeholder.svg';
  };

  const productsInTemplate = useMemo(() => new Set(items.map((i: any) => i.product_id)), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p: any) => {
      if (productsInTemplate.has(p.id)) return false; // hide already added across template
      if (!q) return true;
      return nameOf(p).toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
    });
  }, [products, productsInTemplate, search, lang]);

  const sectionItems = (sectionId: string) =>
    items
      .filter((i: any) => i.section_id === sectionId)
      .map((i: any) => ({ ...i, product: products.find((p: any) => p.id === i.product_id) }))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  return (
    <div className="space-y-6">
      {/* SECTIONS MANAGER */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">{t('admin.sections')}</h3>
        </div>
        <div className="flex gap-2 mb-3">
          <Input
            placeholder={t('admin.newSectionPlaceholder') as string}
            value={newSectionName}
            onChange={e => setNewSectionName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newSectionName.trim()) createSection.mutate(newSectionName.trim()); }}
          />
          <Button
            size="sm"
            onClick={() => newSectionName.trim() && createSection.mutate(newSectionName.trim())}
            disabled={!newSectionName.trim() || createSection.isPending}
          >
            <Plus className="h-4 w-4 mr-1" /> {t('admin.addSection')}
          </Button>
        </div>

        {sections.length === 0 ? (
          <p className="text-sm text-muted-foreground bg-muted/40 rounded p-3">
            {t('admin.noSectionsHint')}
          </p>
        ) : (
          <div className="space-y-2">
            {sections.map((s: any, idx) => {
              const count = items.filter((i: any) => i.section_id === s.id).length;
              const isActive = s.id === activeSectionId;
              return (
                <div
                  key={s.id}
                  className={`border rounded-lg p-3 ${isActive ? 'border-primary bg-primary/5' : 'border-border'}`}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveSectionId(s.id)}
                      className="text-left flex-1"
                      title={t('admin.makeActiveSection') as string}
                    >
                      <span className="font-medium text-sm">{s.name_ca}</span>
                      {s.name_es && <span className="text-xs text-muted-foreground ml-2">/ {s.name_es}</span>}
                      <Badge variant="secondary" className="ml-2">{count}</Badge>
                      {isActive && <Badge className="ml-2">{t('admin.activeSection')}</Badge>}
                    </button>
                    <Button variant="ghost" size="icon" disabled={idx === 0} onClick={() => moveSection(s.id, -1)} title="↑">↑</Button>
                    <Button variant="ghost" size="icon" disabled={idx === sections.length - 1} onClick={() => moveSection(s.id, 1)} title="↓">↓</Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm(t('admin.confirmDeleteSection') as string)) deleteSection.mutate(s.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-2 mt-2">
                    <Input
                      placeholder="Nom (CA)"
                      defaultValue={s.name_ca}
                      onBlur={e => e.target.value !== s.name_ca && updateSection.mutate({ id: s.id, patch: { name_ca: e.target.value } })}
                    />
                    <Input
                      placeholder="Nombre (ES)"
                      defaultValue={s.name_es || ''}
                      onBlur={e => (e.target.value || '') !== (s.name_es || '') && updateSection.mutate({ id: s.id, patch: { name_es: e.target.value || null } })}
                    />
                  </div>

                  {/* Products in this section */}
                  {count > 0 && (
                    <div className="mt-3 border-t pt-3 space-y-1">
                      {sectionItems(s.id).map((it: any) => (
                        <div key={it.id} className="flex items-center justify-between text-sm gap-2">
                          <span className="flex items-center gap-2 min-w-0">
                            <img src={it.product ? imgOf(it.product) : '/placeholder.svg'} alt="" className="h-8 w-8 rounded object-cover bg-muted flex-shrink-0" />
                            <span className="truncate">{it.product ? nameOf(it.product) : `#${it.product_id.slice(0, 6)}`}</span>
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Input
                              type="number" min={1}
                              className="h-7 w-16"
                              defaultValue={it.quantity || 1}
                              onBlur={e => updateQty.mutate({ id: it.id, quantity: parseInt(e.target.value) || 1 })}
                            />
                            <Button variant="ghost" size="icon" onClick={() => removeItem.mutate(it.id)}>
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* VISUAL PRODUCT PICKER */}
      <div>
        <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
          <h3 className="font-semibold text-sm">
            {t('admin.addProductsTo')}{' '}
            <span className="text-primary">
              {sections.find((s: any) => s.id === activeSectionId)?.name_ca || '—'}
            </span>
          </h3>
          <div className="relative w-72 max-w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 h-9" placeholder={t('admin.searchProductToAdd') as string}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {!activeSectionId ? (
          <p className="text-sm text-muted-foreground bg-muted/40 rounded p-3">{t('admin.pickSectionFirst')}</p>
        ) : loadingProducts ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">{t('common.noResults')}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[420px] overflow-auto p-1">
            {filtered.map((p: any) => (
              <button
                type="button"
                key={p.id}
                onClick={() => addItem.mutate(p.id)}
                disabled={addItem.isPending}
                className="group relative text-left border border-border rounded-lg overflow-hidden hover:border-primary hover:shadow-md transition bg-card"
                title={nameOf(p)}
              >
                <div className="aspect-square bg-muted overflow-hidden">
                  <img src={imgOf(p)} alt="" className="w-full h-full object-cover group-hover:scale-105 transition" loading="lazy" />
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium line-clamp-2 leading-tight">{nameOf(p)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{p.sku} · {Number(p.base_price).toFixed(2)} €</p>
                </div>
                <span className="absolute top-2 right-2 h-7 w-7 rounded-full bg-primary text-primary-foreground opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <Plus className="h-4 w-4" />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
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
        <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-auto">
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
