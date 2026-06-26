import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import { notify } from '@/lib/notify';

interface CategoryRow {
  id: string;
  slug: string;
  parent_id: string | null;
  is_active: boolean;
  sort_order: number;
  category_translations: { id: string; language: string; name: string; description: string | null; slug: string | null }[];
}

interface FormData {
  slug: string;
  parent_id: string | null;
  is_active: boolean;
  sort_order: number;
  name_ca: string;
  name_es: string;
  description_ca: string;
  description_es: string;
  slug_ca: string;
  slug_es: string;
}

const emptyForm: FormData = {
  slug: '', parent_id: null, is_active: true, sort_order: 0,
  name_ca: '', name_es: '', description_ca: '', description_es: '',
  slug_ca: '', slug_es: '',
};

const slugifyStr = (s: string) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);


const AdminCategories: React.FC = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*, category_translations(*)')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data as CategoryRow[];
    },
  });

  const getName = (c: CategoryRow, lang: string) =>
    c.category_translations.find(t => t.language === lang)?.name ?? c.slug;

  const getDesc = (c: CategoryRow, lang: string) =>
    c.category_translations.find(t => t.language === lang)?.description ?? '';

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (c: CategoryRow) => {
    setEditId(c.id);
    const trCa = c.category_translations.find(t => t.language === 'ca');
    const trEs = c.category_translations.find(t => t.language === 'es');
    setForm({
      slug: c.slug,
      parent_id: c.parent_id,
      is_active: c.is_active ?? true,
      sort_order: c.sort_order ?? 0,
      name_ca: trCa?.name ?? '',
      name_es: trEs?.name ?? '',
      description_ca: trCa?.description ?? '',
      description_es: trEs?.description ?? '',
      slug_ca: (trCa as any)?.slug ?? '',
      slug_es: (trEs as any)?.slug ?? '',
    });
    setDialogOpen(true);
  };

  // Auto-fill slug when name changes if the slug was empty or matched the previous auto value
  const onNameChange = (lang: 'ca' | 'es', value: string) => {
    setForm(f => {
      const prevName = lang === 'ca' ? f.name_ca : f.name_es;
      const slugKey = lang === 'ca' ? 'slug_ca' : 'slug_es';
      const prevSlug = (f as any)[slugKey] as string;
      const prevAuto = slugifyStr(prevName);
      const nextSlug = (!prevSlug || prevSlug === prevAuto) ? slugifyStr(value) : prevSlug;
      const updates: any = lang === 'ca'
        ? { name_ca: value, slug_ca: nextSlug }
        : { name_es: value, slug_es: nextSlug };
      // Also fill base slug if empty (using default lang ca preferentially)
      if (!f.slug && lang === 'ca') updates.slug = slugifyStr(value);
      return { ...f, ...updates };
    });
  };


  const saveMutation = useMutation({
    mutationFn: async () => {
      const baseSlug = form.slug?.trim() ? slugifyStr(form.slug) : (slugifyStr(form.name_ca) || slugifyStr(form.name_es));
      const slugCa = form.slug_ca?.trim() ? slugifyStr(form.slug_ca) : (form.name_ca ? slugifyStr(form.name_ca) : null);
      const slugEs = form.slug_es?.trim() ? slugifyStr(form.slug_es) : (form.name_es ? slugifyStr(form.name_es) : null);

      if (editId) {
        const { error } = await supabase.from('categories').update({
          slug: baseSlug,
          parent_id: form.parent_id || null,
          is_active: form.is_active,
          sort_order: form.sort_order,
        }).eq('id', editId);
        if (error) throw error;

        for (const lang of ['ca', 'es'] as const) {
          const name = lang === 'ca' ? form.name_ca : form.name_es;
          const description = lang === 'ca' ? form.description_ca : form.description_es;
          const slug = lang === 'ca' ? slugCa : slugEs;
          const existing = categories.find(c => c.id === editId)
            ?.category_translations.find(t => t.language === lang);

          if (existing) {
            const { error: tErr } = await supabase.from('category_translations')
              .update({ name, description: description || null, slug })
              .eq('id', existing.id);
            if (tErr) throw tErr;
          } else {
            const { error: tErr } = await supabase.from('category_translations')
              .insert({ category_id: editId, language: lang, name, description: description || null, slug });
            if (tErr) throw tErr;
          }
        }
      } else {
        const { data: newCat, error } = await supabase.from('categories').insert({
          slug: baseSlug,
          parent_id: form.parent_id || null,
          is_active: form.is_active,
          sort_order: form.sort_order,
        }).select().single();
        if (error) throw error;

        const translations = [
          { category_id: newCat.id, language: 'ca', name: form.name_ca, description: form.description_ca || null, slug: slugCa },
          { category_id: newCat.id, language: 'es', name: form.name_es, description: form.description_es || null, slug: slugEs },
        ];
        const { error: tErr } = await supabase.from('category_translations').insert(translations);
        if (tErr) throw tErr;
      }
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      setDialogOpen(false);
      notify.success(editId ? t('admin.categoryUpdated') : t('admin.categoryCreated'));
    },
    onError: (e: any) => notify.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Delete translations first
      const { error: tErr } = await supabase.from('category_translations').delete().eq('category_id', id);
      if (tErr) throw tErr;
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-categories'] });
      qc.invalidateQueries({ queryKey: ['categories'] });
      setDeleteId(null);
      notify.success(t('admin.categoryDeleted'));
    },
    onError: (e: any) => notify.error(e.message),
  });

  const parentOptions = categories.filter(c => c.id !== editId && !c.parent_id);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-2xl font-bold">{t('admin.categories')}</h1>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-1" /> {t('admin.addCategory')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregant...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>{t('admin.categoryName')} (CA)</TableHead>
              <TableHead>{t('admin.categoryName')} (ES)</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>{t('admin.parentCategory')}</TableHead>
              <TableHead>{t('admin.status')}</TableHead>
              <TableHead className="text-right">{t('admin.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map(c => {
              const parent = c.parent_id ? categories.find(p => p.id === c.parent_id) : null;
              return (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground">{c.sort_order}</TableCell>
                  <TableCell className="font-medium">{getName(c, 'ca')}</TableCell>
                  <TableCell>{getName(c, 'es')}</TableCell>
                  <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{c.slug}</code></TableCell>
                  <TableCell>{parent ? getName(parent, 'ca') : '—'}</TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? 'default' : 'secondary'}>
                      {c.is_active ? t('admin.active') : t('admin.inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(c.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {t('admin.noCategories')}
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
            <DialogTitle>{editId ? t('admin.editCategory') : t('admin.addCategory')}</DialogTitle>
            <DialogDescription>
              {editId ? t('admin.editCategoryDesc') : t('admin.addCategoryDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('admin.categoryName')} (CA) *</Label>
                <Input value={form.name_ca} onChange={e => onNameChange('ca', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.categoryName')} (ES) *</Label>
                <Input value={form.name_es} onChange={e => onNameChange('es', e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Slug (CA)</Label>
                <Input
                  value={form.slug_ca}
                  onChange={e => setForm(f => ({ ...f, slug_ca: slugifyStr(e.target.value) }))}
                  placeholder="auto des del nom"
                />
              </div>
              <div className="space-y-2">
                <Label>Slug (ES)</Label>
                <Input
                  value={form.slug_es}
                  onChange={e => setForm(f => ({ ...f, slug_es: slugifyStr(e.target.value) }))}
                  placeholder="auto desde el nombre"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('admin.description')} (CA)</Label>
                <Textarea value={form.description_ca} onChange={e => setForm(f => ({ ...f, description_ca: e.target.value }))} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.description')} (ES)</Label>
                <Textarea value={form.description_es} onChange={e => setForm(f => ({ ...f, description_es: e.target.value }))} rows={2} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Slug base</Label>
                <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: slugifyStr(e.target.value) }))} placeholder="auto en desar" />
              </div>
              <div className="space-y-2">
                <Label>{t('admin.sortOrder')}</Label>
                <Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('admin.parentCategory')}</Label>
                <Select value={form.parent_id ?? '__none__'} onValueChange={v => setForm(f => ({ ...f, parent_id: v === '__none__' ? null : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— {t('admin.noParent')} —</SelectItem>
                    {parentOptions.map(p => (
                      <SelectItem key={p.id} value={p.id}>{getName(p, 'ca')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label>{t('admin.active')}</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('admin.cancel')}</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!form.slug || !form.name_ca || !form.name_es || saveMutation.isPending}
            >
              {saveMutation.isPending ? '...' : (editId ? t('admin.save') : t('admin.create'))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.confirmDelete')}</DialogTitle>
            <DialogDescription>{t('admin.confirmDeleteCategoryDesc')}</DialogDescription>
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

export default AdminCategories;
