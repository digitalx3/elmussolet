import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Block {
  id: string;
  slug: string;
  kind: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  title_ca: string | null;
  title_es: string | null;
  subtitle_ca: string | null;
  subtitle_es: string | null;
  cta_label_ca: string | null;
  cta_label_es: string | null;
  cta_url: string | null;
  custom_class: string | null;
}

const ICON_OPTIONS = ['Package', 'Store', 'Heart', 'Truck', 'Gift', 'Sparkles', 'ShieldCheck', 'Clock', 'Award'];

const AdminHomeContent: React.FC = () => {
  const qc = useQueryClient();
  const [blocks, setBlocks] = useState<Block[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-home-blocks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cms_blocks')
        .select('*')
        .in('kind', ['home_feature', 'home_cta'])
        .order('kind').order('sort_order');
      if (error) throw error;
      return data as Block[];
    },
  });

  useEffect(() => { if (data) setBlocks(data); }, [data]);

  const updateBlock = (id: string, patch: Partial<Block>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const b of blocks) {
        const { error } = await supabase.from('cms_blocks').update({
          icon: b.icon, sort_order: b.sort_order, is_active: b.is_active,
          title_ca: b.title_ca, title_es: b.title_es,
          subtitle_ca: b.subtitle_ca, subtitle_es: b.subtitle_es,
          cta_label_ca: b.cta_label_ca, cta_label_es: b.cta_label_es,
          cta_url: b.cta_url,
          custom_class: b.custom_class,
        }).eq('id', b.id);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-home-blocks'] }); qc.invalidateQueries({ queryKey: ['home-blocks'] }); toast.success('Contingut desat'); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin" />;

  const features = blocks.filter(b => b.kind === 'home_feature');
  const ctas = blocks.filter(b => b.kind === 'home_cta');

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="font-display text-2xl font-bold">Contingut de la pàgina d'inici</h1>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-1">
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Desar tot
        </Button>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Targetes de característiques</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {features.map(b => (
              <div key={b.id} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground font-mono">{b.slug}</span>
                  <div className="flex items-center gap-3">
                    <Label className="flex items-center gap-2 text-xs">
                      <Switch checked={b.is_active} onCheckedChange={v => updateBlock(b.id, { is_active: v })} /> Activa
                    </Label>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Icona</Label>
                    <select
                      className="w-full border border-input rounded-md h-10 px-3 bg-background text-sm"
                      value={b.icon ?? ''}
                      onChange={e => updateBlock(b.id, { icon: e.target.value })}
                    >
                      {ICON_OPTIONS.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Ordre</Label>
                    <Input type="number" value={b.sort_order} onChange={e => updateBlock(b.id, { sort_order: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Títol (CA)</Label>
                    <Input value={b.title_ca ?? ''} onChange={e => updateBlock(b.id, { title_ca: e.target.value })} />
                  </div>
                  <div>
                    <Label>Títol (ES)</Label>
                    <Input value={b.title_es ?? ''} onChange={e => updateBlock(b.id, { title_es: e.target.value })} />
                  </div>
                  <div>
                    <Label>Descripció (CA)</Label>
                    <Textarea value={b.subtitle_ca ?? ''} onChange={e => updateBlock(b.id, { subtitle_ca: e.target.value })} rows={2} />
                  </div>
                  <div>
                    <Label>Descripció (ES)</Label>
                    <Textarea value={b.subtitle_es ?? ''} onChange={e => updateBlock(b.id, { subtitle_es: e.target.value })} rows={2} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Classe CSS personalitzada</Label>
                    <Input placeholder="bloc-enviament" value={b.custom_class ?? ''} onChange={e => updateBlock(b.id, { custom_class: e.target.value })} />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Bloc de llistes de naixement</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            {ctas.map(b => (
              <div key={b.id} className="border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-mono">{b.slug}</span>
                  <Label className="flex items-center gap-2 text-xs">
                    <Switch checked={b.is_active} onCheckedChange={v => updateBlock(b.id, { is_active: v })} /> Actiu
                  </Label>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Títol (CA)</Label>
                    <Input value={b.title_ca ?? ''} onChange={e => updateBlock(b.id, { title_ca: e.target.value })} />
                  </div>
                  <div>
                    <Label>Títol (ES)</Label>
                    <Input value={b.title_es ?? ''} onChange={e => updateBlock(b.id, { title_es: e.target.value })} />
                  </div>
                  <div>
                    <Label>Descripció (CA)</Label>
                    <Textarea value={b.subtitle_ca ?? ''} onChange={e => updateBlock(b.id, { subtitle_ca: e.target.value })} rows={3} />
                  </div>
                  <div>
                    <Label>Descripció (ES)</Label>
                    <Textarea value={b.subtitle_es ?? ''} onChange={e => updateBlock(b.id, { subtitle_es: e.target.value })} rows={3} />
                  </div>
                  <div>
                    <Label>Botó (CA)</Label>
                    <Input value={b.cta_label_ca ?? ''} onChange={e => updateBlock(b.id, { cta_label_ca: e.target.value })} />
                  </div>
                  <div>
                    <Label>Botó (ES)</Label>
                    <Input value={b.cta_label_es ?? ''} onChange={e => updateBlock(b.id, { cta_label_es: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>URL del botó</Label>
                    <Input value={b.cta_url ?? ''} onChange={e => updateBlock(b.id, { cta_url: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Classe CSS personalitzada</Label>
                    <Input placeholder="bloc-llistes" value={b.custom_class ?? ''} onChange={e => updateBlock(b.id, { custom_class: e.target.value })} />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminHomeContent;
