import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ChevronUp, ChevronDown, Pencil, Layers } from 'lucide-react';
import SubsectionsDialog from '@/components/admin/SubsectionsDialog';
import { supabase } from '@/integrations/supabase/client';
import { useLanguages } from '@/hooks/useLanguages';
import { useDefaultListSections, pickSectionName, DefaultListSection } from '@/hooks/useDefaultListSections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const slugify = (s: string) =>
  s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);

interface FormState {
  id?: string;
  slug: string;
  is_active: boolean;
  names: Record<string, string>; // by language code
}

const empty = (langs: { code: string }[]): FormState => ({
  slug: '',
  is_active: true,
  names: Object.fromEntries(langs.map(l => [l.code, ''])),
});

const AdminDefaultListSections: React.FC = () => {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: languages = [] } = useLanguages({ onlyEnabled: true });
  const { data: sections = [], isLoading } = useDefaultListSections({ onlyActive: false });
  const lang = i18n.language || 'ca';

  const [open, setOpen] = useState(false);
  const [subsOpen, setSubsOpen] = useState<DefaultListSection | null>(null);
  const [form, setForm] = useState<FormState>(empty([]));
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ['default-list-sections'] });

  const openNew = () => {
    setForm(empty(languages));
    setSlugTouched(false);
    setOpen(true);
  };

  const openEdit = (s: DefaultListSection) => {
    const names: Record<string, string> = {};
    languages.forEach(l => { names[l.code] = ''; });
    s.translations.forEach(t => { names[t.language] = t.name; });
    setForm({ id: s.id, slug: s.slug, is_active: s.is_active, names });
    setSlugTouched(true);
    setOpen(true);
  };

  const handleSave = async () => {
    const primaryLang = languages.find(l => l.is_default)?.code || languages[0]?.code || 'ca';
    const primaryName = form.names[primaryLang]?.trim();
    if (!primaryName) {
      toast({ title: t('admin.errorRequired', 'Cal omplir el nom a l’idioma principal'), variant: 'destructive' });
      return;
    }
    const slug = (form.slug || slugify(primaryName)).trim();
    if (!slug) {
      toast({ title: 'Slug invàlid', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let sectionId = form.id;
      if (!sectionId) {
        const { data, error } = await supabase
          .from('default_list_sections')
          .insert({
            slug,
            is_active: form.is_active,
            sort_order: (sections.at(-1)?.sort_order ?? 0) + 10,
          })
          .select('id')
          .single();
        if (error) throw error;
        sectionId = data.id;
      } else {
        const { error } = await supabase
          .from('default_list_sections')
          .update({ slug, is_active: form.is_active })
          .eq('id', sectionId);
        if (error) throw error;
      }
      // Upsert translations for each enabled language with non-empty name
      const rows = languages
        .map(l => ({ section_id: sectionId!, language: l.code, name: (form.names[l.code] || '').trim() }))
        .filter(r => r.name.length > 0);
      if (rows.length > 0) {
        const { error } = await supabase
          .from('default_list_section_translations')
          .upsert(rows, { onConflict: 'section_id,language' });
        if (error) throw error;
      }
      // Remove any translation rows whose name was emptied
      const empties = languages
        .filter(l => !(form.names[l.code] || '').trim())
        .map(l => l.code);
      if (empties.length > 0) {
        await supabase
          .from('default_list_section_translations')
          .delete()
          .eq('section_id', sectionId!)
          .in('language', empties);
      }

      toast({ title: t('common.success', 'Desat correctament') });
      setOpen(false);
      refresh();
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const move = async (s: DefaultListSection, dir: 'up' | 'down') => {
    const idx = sections.findIndex(x => x.id === s.id);
    const target = dir === 'up' ? sections[idx - 1] : sections[idx + 1];
    if (!target) return;
    await Promise.all([
      supabase.from('default_list_sections').update({ sort_order: target.sort_order }).eq('id', s.id),
      supabase.from('default_list_sections').update({ sort_order: s.sort_order }).eq('id', target.id),
    ]);
    refresh();
  };

  const toggleActive = async (s: DefaultListSection, v: boolean) => {
    const { error } = await supabase.from('default_list_sections').update({ is_active: v }).eq('id', s.id);
    if (error) toast({ title: error.message, variant: 'destructive' });
    refresh();
  };

  const remove = async (s: DefaultListSection) => {
    if (!confirm(t('admin.confirmDelete', 'Eliminar?'))) return;
    const { error } = await supabase.from('default_list_sections').delete().eq('id', s.id);
    if (error) toast({ title: error.message, variant: 'destructive' });
    else toast({ title: t('admin.deleted', 'Eliminat') });
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">
            {t('admin.defaultSectionsTitle', 'Famílies per defecte')}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t(
              'admin.defaultSectionsDesc',
              'Aquestes famílies es carreguen automàticament en crear una nova llista de naixement personalitzada.',
            )}
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.addDefaultSection', 'Nova família')}
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">{t('admin.order', 'Ordre')}</TableHead>
              <TableHead>{t('admin.name', 'Nom')}</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>{t('admin.active', 'Activa')}</TableHead>
              <TableHead className="text-right">{t('admin.actions', 'Accions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t('common.loading')}</TableCell></TableRow>
            )}
            {!isLoading && sections.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t('admin.noResults', 'Sense resultats')}</TableCell></TableRow>
            )}
            {!isLoading && sections.map((s, idx) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === 0} onClick={() => move(s, 'up')}>
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={idx === sections.length - 1} onClick={() => move(s, 'down')}>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
                <TableCell className="font-medium">{pickSectionName(s, lang)}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{s.slug}</TableCell>
                <TableCell>
                  <Switch checked={s.is_active} onCheckedChange={(v) => toggleActive(s, v)} />
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setSubsOpen(s)} title="Subfamílies">
                    <Layers className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(s)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form.id ? t('admin.editDefaultSection', 'Editar família') : t('admin.addDefaultSection', 'Nova família')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {languages.map(l => (
              <div key={l.code}>
                <Label>{l.native_name} <span className="text-xs text-muted-foreground">({l.code})</span></Label>
                <Input
                  value={form.names[l.code] || ''}
                  onChange={e => {
                    const v = e.target.value;
                    setForm(f => {
                      const next = { ...f, names: { ...f.names, [l.code]: v } };
                      if (!slugTouched && (l.is_default || (!languages.find(x => x.is_default) && l === languages[0]))) {
                        next.slug = slugify(v);
                      }
                      return next;
                    });
                  }}
                />
              </div>
            ))}
            <div>
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={e => { setForm(f => ({ ...f, slug: e.target.value })); setSlugTouched(true); }}
                className="font-mono"
                placeholder="higiene-personal"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))} />
              <Label>{t('admin.active', 'Activa')}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={saving}>{t('common.save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDefaultListSections;
