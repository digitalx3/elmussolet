import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil } from 'lucide-react';

const TABLE_SETTINGS = 'cookie_settings' as const;
const TABLE_CATS = 'cookie_categories' as const;
const TABLE_REG = 'cookies_registry' as const;
const TABLE_LOG = 'cookie_consent_log' as const;

interface Category {
  id: string; key: string; is_required: boolean; is_enabled: boolean; sort_order: number;
  name_ca: string; name_es: string; description_ca: string; description_es: string;
}
interface RegItem {
  id: string; name: string; provider: string; category_id: string;
  purpose_ca: string; purpose_es: string; duration: string;
  type: 'first_party' | 'third_party'; requires_consent: boolean;
  service: string; sort_order: number;
}

const AdminCookies: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold mb-1">{t('admin.cookies.title', 'Gestió de cookies')}</h1>
        <p className="text-muted-foreground text-sm">
          {t('admin.cookies.desc', 'Configura el mòdul de cookies, les categories, les cookies registrades i el registre de consentiments.')}
        </p>
      </div>
      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">{t('admin.cookies.tabSettings', 'Configuració')}</TabsTrigger>
          <TabsTrigger value="categories">{t('admin.cookies.tabCategories', 'Categories')}</TabsTrigger>
          <TabsTrigger value="registry">{t('admin.cookies.tabRegistry', 'Cookies')}</TabsTrigger>
          <TabsTrigger value="log">{t('admin.cookies.tabLog', 'Registre consentiments')}</TabsTrigger>
        </TabsList>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
        <TabsContent value="categories"><CategoriesTab /></TabsContent>
        <TabsContent value="registry"><RegistryTab /></TabsContent>
        <TabsContent value="log"><LogTab /></TabsContent>
      </Tabs>
    </div>
  );
};

/* ---------------- Settings ---------------- */
const SettingsTab: React.FC = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-cookie-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from(TABLE_SETTINGS as any).select('*').limit(1).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
  const [form, setForm] = useState<any>(null);
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from(TABLE_SETTINGS as any).update({
        policy_version: form.policy_version,
        ga_enabled: form.ga_enabled,
        ga_measurement_id: form.ga_measurement_id,
        maps_requires_consent: form.maps_requires_consent,
        banner_text_ca: form.banner_text_ca, banner_text_es: form.banner_text_es,
        banner_text_short_ca: form.banner_text_short_ca, banner_text_short_es: form.banner_text_short_es,
        policy_url: form.policy_url,
      }).eq('id', form.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('common.saved', 'Desat'));
      qc.invalidateQueries({ queryKey: ['admin-cookie-settings'] });
      qc.invalidateQueries({ queryKey: ['cookie-settings'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading || !form) return <p className="text-sm text-muted-foreground py-6">{t('common.loading', 'Carregant...')}</p>;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t('admin.cookies.tabSettings', 'Configuració')}</CardTitle></CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('admin.cookies.policyVersion', 'Versió de la política')}</Label>
          <Input type="number" min={1} value={form.policy_version}
            onChange={(e) => setForm({ ...form, policy_version: parseInt(e.target.value || '1', 10) })} />
          <p className="text-xs text-muted-foreground">{t('admin.cookies.policyVersionHelp', 'Incrementa per forçar reconfirmació de tots els usuaris.')}</p>
        </div>
        <div className="space-y-2">
          <Label>{t('admin.cookies.policyUrl', 'URL de la política de cookies')}</Label>
          <Input value={form.policy_url || ''} onChange={(e) => setForm({ ...form, policy_url: e.target.value })} />
        </div>

        <div className="space-y-2 md:col-span-2 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('admin.cookies.ga', 'Google Analytics')}</Label>
              <p className="text-xs text-muted-foreground">{t('admin.cookies.gaHelp', 'Es carrega només si l\'usuari accepta cookies analítiques.')}</p>
            </div>
            <Switch checked={!!form.ga_enabled} onCheckedChange={(v) => setForm({ ...form, ga_enabled: !!v })} />
          </div>
          <Input placeholder="G-XXXXXXXXXX" value={form.ga_measurement_id || ''}
            onChange={(e) => setForm({ ...form, ga_measurement_id: e.target.value })} disabled={!form.ga_enabled} />
        </div>

        <div className="space-y-2 md:col-span-2 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>{t('admin.cookies.maps', 'Google Maps requereix consentiment')}</Label>
              <p className="text-xs text-muted-foreground">{t('admin.cookies.mapsHelp', 'Si està actiu, el mapa de contacte mostra un placeholder fins que s\'acceptin les cookies de tercers.')}</p>
            </div>
            <Switch checked={!!form.maps_requires_consent} onCheckedChange={(v) => setForm({ ...form, maps_requires_consent: !!v })} />
          </div>
        </div>

        <div className="space-y-2 md:col-span-2 border-t border-border pt-4">
          <Label>{t('admin.cookies.bannerCa', 'Text del banner (CA)')}</Label>
          <Textarea rows={3} value={form.banner_text_ca || ''} onChange={(e) => setForm({ ...form, banner_text_ca: e.target.value })} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>{t('admin.cookies.bannerEs', 'Text del banner (ES)')}</Label>
          <Textarea rows={3} value={form.banner_text_es || ''} onChange={(e) => setForm({ ...form, banner_text_es: e.target.value })} />
        </div>

        <div className="md:col-span-2 flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{t('common.save', 'Desar')}</Button>
        </div>
      </CardContent>
    </Card>
  );
};

/* ---------------- Categories ---------------- */
const CategoriesTab: React.FC = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: cats = [] } = useQuery({
    queryKey: ['admin-cookie-cats'],
    queryFn: async () => {
      const { data, error } = await supabase.from(TABLE_CATS as any).select('*').order('sort_order');
      if (error) throw error;
      return (data ?? []) as unknown as Category[];
    },
  });

  const update = useMutation({
    mutationFn: async (c: Partial<Category> & { id: string }) => {
      const { error } = await supabase.from(TABLE_CATS as any).update(c).eq('id', c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-cookie-cats'] });
      qc.invalidateQueries({ queryKey: ['cookie-categories'] });
      toast.success(t('common.saved', 'Desat'));
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t('admin.cookies.tabCategories', 'Categories')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {cats.map(c => (
          <div key={c.id} className="border border-border rounded-md p-4 grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <code className="text-xs px-2 py-0.5 bg-muted rounded">{c.key}</code>
                {c.is_required && <Badge variant="secondary">{t('admin.cookies.required', 'Obligatòria')}</Badge>}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Label className="flex items-center gap-2">
                  <Switch
                    checked={!!c.is_enabled}
                    disabled={c.is_required}
                    onCheckedChange={(v) => update.mutate({ id: c.id, is_enabled: !!v })}
                  />
                  {t('admin.cookies.enabled', 'Activa')}
                </Label>
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t('admin.cookies.nameCa', 'Nom (CA)')}</Label>
              <Input defaultValue={c.name_ca} onBlur={(e) => e.target.value !== c.name_ca && update.mutate({ id: c.id, name_ca: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>{t('admin.cookies.nameEs', 'Nom (ES)')}</Label>
              <Input defaultValue={c.name_es} onBlur={(e) => e.target.value !== c.name_es && update.mutate({ id: c.id, name_es: e.target.value })} />
            </div>
            <div className="space-y-1 md:col-span-1">
              <Label>{t('admin.cookies.descCa', 'Descripció (CA)')}</Label>
              <Textarea rows={2} defaultValue={c.description_ca}
                onBlur={(e) => e.target.value !== c.description_ca && update.mutate({ id: c.id, description_ca: e.target.value })} />
            </div>
            <div className="space-y-1 md:col-span-1">
              <Label>{t('admin.cookies.descEs', 'Descripció (ES)')}</Label>
              <Textarea rows={2} defaultValue={c.description_es}
                onBlur={(e) => e.target.value !== c.description_es && update.mutate({ id: c.id, description_es: e.target.value })} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

/* ---------------- Registry ---------------- */
const emptyReg: Omit<RegItem, 'id'> = {
  name: '', provider: '', category_id: '', purpose_ca: '', purpose_es: '',
  duration: '', type: 'first_party', requires_consent: false, service: '', sort_order: 0,
};

const RegistryTab: React.FC = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<RegItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Omit<RegItem, 'id'>>(emptyReg);

  const { data: cats = [] } = useQuery({
    queryKey: ['admin-cookie-cats'],
    queryFn: async () => {
      const { data, error } = await supabase.from(TABLE_CATS as any).select('*').order('sort_order');
      if (error) throw error;
      return (data ?? []) as unknown as Category[];
    },
  });
  const { data: items = [] } = useQuery({
    queryKey: ['admin-cookies-registry'],
    queryFn: async () => {
      const { data, error } = await supabase.from(TABLE_REG as any).select('*').order('sort_order');
      if (error) throw error;
      return (data ?? []) as unknown as RegItem[];
    },
  });

  const catName = (id: string) => cats.find(c => c.id === id)?.name_ca ?? '—';

  const upsert = useMutation({
    mutationFn: async () => {
      if (editing) {
        const { error } = await supabase.from(TABLE_REG as any).update(draft).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from(TABLE_REG as any).insert(draft);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-cookies-registry'] });
      qc.invalidateQueries({ queryKey: ['cookies-registry'] });
      toast.success(t('common.saved', 'Desat'));
      setEditing(null); setCreating(false); setDraft(emptyReg);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABLE_REG as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-cookies-registry'] });
      qc.invalidateQueries({ queryKey: ['cookies-registry'] });
      toast.success(t('common.deleted', 'Eliminat'));
    },
    onError: (e: any) => toast.error(e.message),
  });

  const startCreate = () => {
    setEditing(null);
    setDraft({ ...emptyReg, category_id: cats[0]?.id ?? '' });
    setCreating(true);
  };
  const startEdit = (it: RegItem) => {
    setCreating(false);
    setEditing(it);
    const { id: _id, ...rest } = it;
    setDraft(rest);
  };
  const dialogOpen = creating || !!editing;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t('admin.cookies.tabRegistry', 'Cookies')}</CardTitle>
        <Button size="sm" onClick={startCreate}><Plus className="h-4 w-4 mr-1" />{t('admin.cookies.new', 'Nova cookie')}</Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr><th className="py-2 pr-2">Nom</th><th className="py-2 pr-2">Proveïdor</th><th className="py-2 pr-2">Categoria</th><th className="py-2 pr-2">Tipus</th><th className="py-2 pr-2">Durada</th><th></th></tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} className="border-t border-border">
                  <td className="py-2 pr-2 font-mono text-xs">{it.name}</td>
                  <td className="py-2 pr-2">{it.provider}</td>
                  <td className="py-2 pr-2">{catName(it.category_id)}</td>
                  <td className="py-2 pr-2">{it.type === 'third_party' ? 'Tercers' : 'Pròpia'}</td>
                  <td className="py-2 pr-2">{it.duration}</td>
                  <td className="py-2 text-right">
                    <Button size="icon" variant="ghost" onClick={() => startEdit(it)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => confirm('Eliminar?') && del.mutate(it.id)}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && (setEditing(null), setCreating(false))}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? t('admin.cookies.edit', 'Editar cookie') : t('admin.cookies.new', 'Nova cookie')}</DialogTitle></DialogHeader>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Nom</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Proveïdor</Label><Input value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value })} /></div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={draft.category_id} onValueChange={(v) => setDraft({ ...draft, category_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{cats.map(c => <SelectItem key={c.id} value={c.id}>{c.name_ca}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Tipus</Label>
              <Select value={draft.type} onValueChange={(v: any) => setDraft({ ...draft, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="first_party">Pròpia</SelectItem>
                  <SelectItem value="third_party">De tercers</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Servei</Label><Input value={draft.service} onChange={(e) => setDraft({ ...draft, service: e.target.value })} /></div>
            <div className="space-y-1"><Label>Durada</Label><Input value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} /></div>
            <div className="space-y-1 md:col-span-2"><Label>Finalitat (CA)</Label><Textarea rows={2} value={draft.purpose_ca} onChange={(e) => setDraft({ ...draft, purpose_ca: e.target.value })} /></div>
            <div className="space-y-1 md:col-span-2"><Label>Finalitat (ES)</Label><Textarea rows={2} value={draft.purpose_es} onChange={(e) => setDraft({ ...draft, purpose_es: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={!!draft.requires_consent} onCheckedChange={(v) => setDraft({ ...draft, requires_consent: !!v })} /><Label>Requereix consentiment</Label></div>
            <div className="space-y-1"><Label>Ordre</Label><Input type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: parseInt(e.target.value || '0', 10) })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditing(null); setCreating(false); }}>Cancel·lar</Button>
            <Button onClick={() => upsert.mutate()} disabled={upsert.isPending || !draft.name || !draft.category_id}>Desar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

/* ---------------- Log ---------------- */
const LogTab: React.FC = () => {
  const { t } = useTranslation();
  const { data: log = [], isLoading } = useQuery({
    queryKey: ['admin-cookie-log'],
    queryFn: async () => {
      const { data, error } = await supabase.from(TABLE_LOG as any).select('*').order('created_at', { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t('admin.cookies.tabLog', 'Registre consentiments')}</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <p className="text-sm text-muted-foreground">Carregant...</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr><th className="py-2 pr-2">Data</th><th className="py-2 pr-2">Usuari</th><th className="py-2 pr-2">Anon ID</th><th className="py-2 pr-2">Versió</th><th className="py-2 pr-2">Origen</th><th className="py-2 pr-2">Categories acceptades</th></tr>
              </thead>
              <tbody>
                {log.map((r: any) => {
                  const cats = r.consent || {};
                  const accepted = Object.entries(cats).filter(([, v]) => !!v).map(([k]) => k).join(', ');
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-2 pr-2">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-2 font-mono">{r.user_id ? r.user_id.slice(0, 8) : '—'}</td>
                      <td className="py-2 pr-2 font-mono">{r.anon_id?.slice(0, 8)}</td>
                      <td className="py-2 pr-2">{r.policy_version}</td>
                      <td className="py-2 pr-2">{r.source}</td>
                      <td className="py-2 pr-2">{accepted}</td>
                    </tr>
                  );
                })}
                {log.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-muted-foreground">Sense registres</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminCookies;
