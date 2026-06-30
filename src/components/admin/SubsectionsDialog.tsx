import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ChevronUp, ChevronDown, Pencil, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguages } from '@/hooks/useLanguages';
import {
  useDefaultListSubsections,
  pickSubsectionName,
  type DefaultListSubsection,
} from '@/hooks/useDefaultListSubsections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const slugify = (s: string) =>
  s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);

interface Props {
  sectionId: string;
  sectionName: string;
  open: boolean;
  onClose: () => void;
}

const empty = (langs: { code: string }[]) => ({
  id: undefined as string | undefined,
  slug: '',
  is_active: true,
  names: Object.fromEntries(langs.map(l => [l.code, ''])) as Record<string, string>,
});

const SubsectionsDialog: React.FC<Props> = ({ sectionId, sectionName, open, onClose }) => {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: languages = [] } = useLanguages({ onlyEnabled: true });
  const { data: subsections = [], isLoading } = useDefaultListSubsections({
    onlyActive: false,
    sectionId: open ? sectionId : null,
  });
  const lang = i18n.language || 'ca';

  const [form, setForm] = useState(empty([]));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (!open) { setEditing(false); }
  }, [open]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['default-list-subsections'] });

  const openNew = () => {
    setForm(empty(languages));
    setSlugTouched(false);
    setEditing(true);
  };

  const openEdit = (s: DefaultListSubsection) => {
    const names: Record<string, string> = {};
    languages.forEach(l => { names[l.code] = ''; });
    s.translations.forEach(t => { names[t.language] = t.name; });
    setForm({ id: s.id, slug: s.slug, is_active: s.is_active, names });
    setSlugTouched(true);
    setEditing(true);
  };

  const handleSave = async () => {
    const primary = languages.find(l => l.is_default)?.code || languages[0]?.code || 'ca';
    const name = form.names[primary]?.trim();
    if (!name) {
      toast({ title: 'Cal omplir el nom a l’idioma principal', variant: 'destructive' });
      return;
    }
    const slug = (form.slug || slugify(name)).trim();
    setSaving(true);
    try {
      let id = form.id;
      if (!id) {
        const { data, error } = await supabase
          .from('default_list_subsections')
          .insert({
            section_id: sectionId,
            slug,
            is_active: form.is_active,
            sort_order: (subsections.at(-1)?.sort_order ?? 0) + 10,
          })
          .select('id').single();
        if (error) throw error;
        id = data.id;
      } else {
        const { error } = await supabase
          .from('default_list_subsections')
          .update({ slug, is_active: form.is_active })
          .eq('id', id);
        if (error) throw error;
      }
      const rows = languages
        .map(l => ({ subsection_id: id!, language: l.code, name: (form.names[l.code] || '').trim() }))
        .filter(r => r.name.length > 0);
      if (rows.length > 0) {
        await supabase.from('default_list_subsection_translations')
          .upsert(rows, { onConflict: 'subsection_id,language' });
      }
      const empties = languages.filter(l => !(form.names[l.code] || '').trim()).map(l => l.code);
      if (empties.length > 0) {
        await supabase.from('default_list_subsection_translations')
          .delete().eq('subsection_id', id!).in('language', empties);
      }
      toast({ title: 'Desat' });
      setEditing(false);
      refresh();
    } catch (e: any) {
      toast({ title: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const move = async (s: DefaultListSubsection, dir: 'up' | 'down') => {
    const idx = subsections.findIndex(x => x.id === s.id);
    const target = dir === 'up' ? subsections[idx - 1] : subsections[idx + 1];
    if (!target) return;
    await Promise.all([
      supabase.from('default_list_subsections').update({ sort_order: target.sort_order }).eq('id', s.id),
      supabase.from('default_list_subsections').update({ sort_order: s.sort_order }).eq('id', target.id),
    ]);
    refresh();
  };

  const toggleActive = async (s: DefaultListSubsection, v: boolean) => {
    await supabase.from('default_list_subsections').update({ is_active: v }).eq('id', s.id);
    refresh();
  };

  const remove = async (s: DefaultListSubsection) => {
    if (!confirm('Eliminar aquesta subfamília?')) return;
    await supabase.from('default_list_subsections').delete().eq('id', s.id);
    refresh();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Subfamílies — {sectionName}</DialogTitle>
        </DialogHeader>

        {!editing && (
          <>
            <div className="flex justify-end mb-2">
              <Button size="sm" onClick={openNew}>
                <Plus className="h-4 w-4 mr-1" /> Nova subfamília
              </Button>
            </div>
            <div className="border rounded-md divide-y">
              {isLoading && <p className="p-4 text-center text-muted-foreground text-sm">{t('common.loading')}</p>}
              {!isLoading && subsections.length === 0 && (
                <p className="p-4 text-center text-muted-foreground text-sm">Cap subfamília encara.</p>
              )}
              {!isLoading && subsections.map((s, idx) => (
                <div key={s.id} className="flex items-center gap-2 p-2">
                  <div className="flex flex-col">
                    <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === 0} onClick={() => move(s, 'up')}>
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" disabled={idx === subsections.length - 1} onClick={() => move(s, 'down')}>
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{pickSubsectionName(s, lang)}</div>
                    <div className="text-xs text-muted-foreground font-mono truncate">{s.slug}</div>
                  </div>
                  <Switch checked={s.is_active} onCheckedChange={(v) => toggleActive(s, v)} />
                  <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(s)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}

        {editing && (
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
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))} />
              <Label>Activa</Label>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(false)}>{t('common.cancel')}</Button>
              <Button onClick={handleSave} disabled={saving}>{t('common.save')}</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SubsectionsDialog;
