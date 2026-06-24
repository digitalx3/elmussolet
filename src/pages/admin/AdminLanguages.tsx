import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Plus, Trash2, Check, Star, Languages as LanguagesIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguages } from '@/hooks/useLanguages';
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

const AdminLanguages: React.FC = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: languages = [], isLoading } = useLanguages({ onlyEnabled: false });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', native_name: '' });
  const [saving, setSaving] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ['languages'] });

  const handleCreate = async () => {
    if (!form.code || !form.name || !form.native_name) {
      toast({ title: t('admin.errorRequired', 'Cal omplir tots els camps'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('languages').insert({
      code: form.code.trim().toLowerCase(),
      name: form.name.trim(),
      native_name: form.native_name.trim(),
      is_enabled: true,
      is_default: false,
      sort_order: (languages.length + 1) * 10,
    });
    setSaving(false);
    if (error) {
      toast({ title: error.message, variant: 'destructive' });
      return;
    }
    setOpen(false);
    setForm({ code: '', name: '', native_name: '' });
    toast({ title: t('admin.languageCreated', 'Idioma creat') });
    refresh();
  };

  const toggleEnabled = async (code: string, v: boolean) => {
    const { error } = await supabase.from('languages').update({ is_enabled: v }).eq('code', code);
    if (error) toast({ title: error.message, variant: 'destructive' });
    refresh();
  };

  const makeDefault = async (code: string) => {
    // Unset previous default, then set new
    const prev = languages.find(l => l.is_default);
    if (prev && prev.code !== code) {
      await supabase.from('languages').update({ is_default: false }).eq('code', prev.code);
    }
    const { error } = await supabase.from('languages').update({ is_default: true, is_enabled: true }).eq('code', code);
    if (error) toast({ title: error.message, variant: 'destructive' });
    else toast({ title: t('admin.languageDefaultSet', 'Idioma per defecte actualitzat') });
    refresh();
  };

  const remove = async (code: string) => {
    if (!confirm(t('admin.confirmDeleteLanguage', 'Eliminar aquest idioma? No es podrà eliminar si té contingut traduït.'))) return;
    const { error } = await supabase.from('languages').delete().eq('code', code);
    if (error) toast({ title: error.message, variant: 'destructive' });
    else toast({ title: t('admin.languageDeleted', 'Idioma eliminat') });
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">{t('admin.languagesTitle', 'Idiomes')}</h1>
          <p className="text-muted-foreground text-sm">
            {t('admin.languagesDesc', 'Gestiona els idiomes disponibles a la botiga i a l’administració.')}
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.addLanguage', 'Nou idioma')}
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.languageCode', 'Codi')}</TableHead>
              <TableHead>{t('admin.languageName', 'Nom')}</TableHead>
              <TableHead>{t('admin.languageNative', 'Nom natiu')}</TableHead>
              <TableHead>{t('admin.languageEnabled', 'Actiu')}</TableHead>
              <TableHead>{t('admin.languageDefault', 'Per defecte')}</TableHead>
              <TableHead className="text-right">{t('admin.actions', 'Accions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t('common.loading')}</TableCell></TableRow>
            )}
            {!isLoading && languages.map(l => (
              <TableRow key={l.code}>
                <TableCell className="font-mono uppercase">{l.code}</TableCell>
                <TableCell>{l.name}</TableCell>
                <TableCell>{l.native_name}</TableCell>
                <TableCell>
                  <Switch checked={l.is_enabled} onCheckedChange={(v) => toggleEnabled(l.code, v)} disabled={l.is_default} />
                </TableCell>
                <TableCell>
                  {l.is_default ? (
                    <span className="inline-flex items-center gap-1 text-primary text-xs font-semibold">
                      <Check className="h-3.5 w-3.5" /> {t('admin.languageDefault', 'Per defecte')}
                    </span>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => makeDefault(l.code)}>
                      <Star className="h-3.5 w-3.5 mr-1" /> {t('admin.makeDefault', 'Fer per defecte')}
                    </Button>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" disabled={l.is_default} onClick={() => remove(l.code)}>
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
            <DialogTitle>{t('admin.addLanguage', 'Nou idioma')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t('admin.languageCode', 'Codi')} (ISO 639-1)</Label>
              <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="en" maxLength={5} />
            </div>
            <div>
              <Label>{t('admin.languageName', 'Nom')}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="English" />
            </div>
            <div>
              <Label>{t('admin.languageNative', 'Nom natiu')}</Label>
              <Input value={form.native_name} onChange={e => setForm(f => ({ ...f, native_name: e.target.value }))} placeholder="English" />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('admin.languageHelp', 'Després d’afegir un idioma, cal pujar el fitxer de traduccions UI corresponent (src/locales/<codi>.json) per traduir l’interfície. El contingut (productes, slides, etc.) s’edita des de cada formulari.')}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreate} disabled={saving}>{t('common.create')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLanguages;
