import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Save, Loader2, Package, Store, Heart, Truck, Gift, Sparkles, ShieldCheck, Clock, Award,
  Baby, Star, ThumbsUp, Tag, MapPin, Phone, Mail, Camera, Home, Smile,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import ImageUploader from '@/components/admin/ImageUploader';
import LanguageTabs from '@/components/admin/LanguageTabs';
import { useLanguages, useDefaultLanguage } from '@/hooks/useLanguages';

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
  image_url: string | null;
  image_url_2: string | null;
  background_color: string | null;
  background_gradient: string | null;
}

interface BlockTranslation {
  block_id: string;
  language_code: string;
  title: string | null;
  subtitle: string | null;
  cta_label: string | null;
}

type TranslationMap = Record<string, Record<string, { title: string; subtitle: string; cta_label: string }>>;

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Package, Store, Heart, Truck, Gift, Sparkles, ShieldCheck, Clock, Award,
  Baby, Star, ThumbsUp, Tag, MapPin, Phone, Mail, Camera, Home, Smile,
};
const ICON_OPTIONS = Object.keys(ICON_MAP);

const IconPicker: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
  <div className="grid grid-cols-6 sm:grid-cols-10 gap-2 p-3 rounded-md border border-input bg-background">
    {ICON_OPTIONS.map(name => {
      const Icon = ICON_MAP[name];
      const active = value === name;
      return (
        <button
          key={name}
          type="button"
          onClick={() => onChange(name)}
          title={name}
          className={cn(
            'h-10 w-10 rounded-md flex items-center justify-center border transition-colors',
            active
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-muted/40 text-foreground hover:bg-muted'
          )}
        >
          <Icon className="h-5 w-5" />
        </button>
      );
    })}
  </div>
);

const AdminHomeContent: React.FC = () => {
  const qc = useQueryClient();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [translations, setTranslations] = useState<TranslationMap>({});

  const { data: languages = [] } = useLanguages({ onlyEnabled: true });
  const { data: defaultLang } = useDefaultLanguage();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-home-blocks'],
    queryFn: async () => {
      const { data: blocksData, error } = await supabase
        .from('cms_blocks')
        .select('*')
        .in('kind', ['home_feature', 'home_cta'])
        .order('kind').order('sort_order');
      if (error) throw error;

      const blockIds = (blocksData ?? []).map((b: any) => b.id);
      let trs: BlockTranslation[] = [];
      if (blockIds.length > 0) {
        const { data: trData, error: trErr } = await supabase
          .from('cms_block_translations')
          .select('block_id, language_code, title, subtitle, cta_label')
          .in('block_id', blockIds);
        if (trErr) throw trErr;
        trs = (trData ?? []) as BlockTranslation[];
      }
      return { blocks: (blocksData ?? []) as Block[], translations: trs };
    },
  });

  useEffect(() => {
    if (!data) return;
    setBlocks(data.blocks);
    const map: TranslationMap = {};
    data.blocks.forEach((b) => {
      map[b.id] = {};
      // Seed from legacy *_ca/*_es columns so initial state isn't empty.
      map[b.id]['ca'] = {
        title: b.title_ca ?? '', subtitle: b.subtitle_ca ?? '', cta_label: b.cta_label_ca ?? '',
      };
      map[b.id]['es'] = {
        title: b.title_es ?? '', subtitle: b.subtitle_es ?? '', cta_label: b.cta_label_es ?? '',
      };
    });
    data.translations.forEach((tr) => {
      if (!map[tr.block_id]) map[tr.block_id] = {};
      map[tr.block_id][tr.language_code] = {
        title: tr.title ?? '',
        subtitle: tr.subtitle ?? '',
        cta_label: tr.cta_label ?? '',
      };
    });
    setTranslations(map);
  }, [data]);

  const updateBlock = (id: string, patch: Partial<Block>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b));
  };

  const updateTr = (
    blockId: string,
    code: string,
    field: 'title' | 'subtitle' | 'cta_label',
    val: string,
  ) => {
    setTranslations((prev) => ({
      ...prev,
      [blockId]: {
        ...(prev[blockId] ?? {}),
        [code]: {
          ...(prev[blockId]?.[code] ?? { title: '', subtitle: '', cta_label: '' }),
          [field]: val,
        },
      },
    }));
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const defaultCode = defaultLang?.code ?? 'ca';
      for (const b of blocks) {
        const trs = translations[b.id] ?? {};
        // Sync legacy ca/es columns from the translations map.
        const ca = trs['ca'] ?? { title: b.title_ca ?? '', subtitle: b.subtitle_ca ?? '', cta_label: b.cta_label_ca ?? '' };
        const es = trs['es'] ?? { title: b.title_es ?? '', subtitle: b.subtitle_es ?? '', cta_label: b.cta_label_es ?? '' };

        const { error } = await supabase.from('cms_blocks').update({
          icon: b.icon, sort_order: b.sort_order, is_active: b.is_active,
          title_ca: ca.title || null,
          title_es: es.title || null,
          subtitle_ca: ca.subtitle || null,
          subtitle_es: es.subtitle || null,
          cta_label_ca: ca.cta_label || null,
          cta_label_es: es.cta_label || null,
          cta_url: b.cta_url,
          custom_class: b.custom_class,
          image_url: b.image_url, image_url_2: b.image_url_2,
          background_color: b.background_color, background_gradient: b.background_gradient,
        }).eq('id', b.id);
        if (error) throw error;

        // Upsert / clean translations for every enabled language.
        const rows = languages.map((lng) => {
          const t = trs[lng.code] ?? { title: '', subtitle: '', cta_label: '' };
          return {
            block_id: b.id,
            language_code: lng.code,
            title: t.title?.trim() || null,
            subtitle: t.subtitle?.trim() || null,
            cta_label: t.cta_label?.trim() || null,
          };
        });
        const meaningful = rows.filter((r) => r.title || r.subtitle || r.cta_label);
        if (meaningful.length > 0) {
          const { error: upErr } = await supabase
            .from('cms_block_translations')
            .upsert(meaningful, { onConflict: 'block_id,language_code' });
          if (upErr) throw upErr;
        }
        const emptyCodes = rows.filter((r) => !r.title && !r.subtitle && !r.cta_label).map((r) => r.language_code);
        if (emptyCodes.length > 0) {
          await supabase
            .from('cms_block_translations')
            .delete()
            .eq('block_id', b.id)
            .in('language_code', emptyCodes);
        }
        void defaultCode;
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
                <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-start">
                  <div>
                    <Label>Icona</Label>
                    <IconPicker value={b.icon ?? ''} onChange={v => updateBlock(b.id, { icon: v })} />
                  </div>
                  <div className="w-32">
                    <Label>Ordre</Label>
                    <Input type="number" value={b.sort_order} onChange={e => updateBlock(b.id, { sort_order: Number(e.target.value) })} />
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">Traduccions</Label>
                  <LanguageTabs>
                    {(code) => (
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <Label className="text-xs">Títol ({code.toUpperCase()})</Label>
                          <Input
                            value={translations[b.id]?.[code]?.title ?? ''}
                            onChange={(e) => updateTr(b.id, code, 'title', e.target.value)}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-xs">Descripció ({code.toUpperCase()})</Label>
                          <Textarea
                            rows={2}
                            value={translations[b.id]?.[code]?.subtitle ?? ''}
                            onChange={(e) => updateTr(b.id, code, 'subtitle', e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </LanguageTabs>
                </div>
                <div>
                  <Label>Classe CSS personalitzada</Label>
                  <Input placeholder="bloc-enviament" value={b.custom_class ?? ''} onChange={e => updateBlock(b.id, { custom_class: e.target.value })} />
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
                <div>
                  <Label className="mb-2 block">Traduccions</Label>
                  <LanguageTabs>
                    {(code) => (
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <Label className="text-xs">Títol ({code.toUpperCase()})</Label>
                          <Input
                            value={translations[b.id]?.[code]?.title ?? ''}
                            onChange={(e) => updateTr(b.id, code, 'title', e.target.value)}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-xs">Descripció ({code.toUpperCase()})</Label>
                          <Textarea
                            rows={3}
                            value={translations[b.id]?.[code]?.subtitle ?? ''}
                            onChange={(e) => updateTr(b.id, code, 'subtitle', e.target.value)}
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-xs">Botó ({code.toUpperCase()})</Label>
                          <Input
                            value={translations[b.id]?.[code]?.cta_label ?? ''}
                            onChange={(e) => updateTr(b.id, code, 'cta_label', e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </LanguageTabs>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <Label>URL del botó</Label>
                    <Input value={b.cta_url ?? ''} onChange={e => updateBlock(b.id, { cta_url: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2 grid sm:grid-cols-2 gap-4 pt-2 border-t border-border">
                    <div>
                      <Label>Imatge principal (fons dreta)</Label>
                      <ImageUploader
                        value={b.image_url ?? ''}
                        onChange={v => updateBlock(b.id, { image_url: v })}
                        pathPrefix="home-cta"
                        previewClassName="h-24"
                      />
                    </div>
                    <div>
                      <Label>Imatge secundària (lateral)</Label>
                      <ImageUploader
                        value={b.image_url_2 ?? ''}
                        onChange={v => updateBlock(b.id, { image_url_2: v })}
                        pathPrefix="home-cta"
                        previewClassName="h-24"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Color de fons</Label>
                    <div className="flex gap-2 items-center">
                      <Input type="color" value={b.background_color || '#7a3b1f'} onChange={e => updateBlock(b.id, { background_color: e.target.value })} className="w-16 h-10 p-1" />
                      <Input placeholder="#7a3b1f o hsl(...)" value={b.background_color ?? ''} onChange={e => updateBlock(b.id, { background_color: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <Label>Gradient de fons (CSS, prioritari)</Label>
                    <Input placeholder="linear-gradient(135deg, #7a3b1f, #c0744a)" value={b.background_gradient ?? ''} onChange={e => updateBlock(b.id, { background_gradient: e.target.value })} />
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
