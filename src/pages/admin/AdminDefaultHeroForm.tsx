import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save, Upload, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { optimizeImage } from '@/lib/optimizeImage';
import DefaultHero from '@/components/home/DefaultHero';
import LanguageTabs from '@/components/admin/LanguageTabs';
import {
  DEFAULT_HERO,
  DEFAULT_HERO_OVERRIDES_KEY,
  DEFAULT_HERO_OVERRIDES_KEY_2,
  DefaultHeroOverrides,
  HeroLanguageContent,
} from '@/lib/defaultHeroSlide';

const ASPECTS: DefaultHeroOverrides['image_aspect'][] = ['1/1', '4/5', '4/3', '3/4', '16/9'];

type HeroState = Required<typeof DEFAULT_HERO>;

const VARIANTS = [
  { id: 1 as const, key: DEFAULT_HERO_OVERRIDES_KEY, label: 'Variant 1' },
  { id: 2 as const, key: DEFAULT_HERO_OVERRIDES_KEY_2, label: 'Variant 2' },
];

const AdminDefaultHeroForm: React.FC = () => {
  const qc = useQueryClient();
  const [activeVariant, setActiveVariant] = useState<1 | 2>(1);
  const [states, setStates] = useState<Record<1 | 2, HeroState>>({
    1: { ...DEFAULT_HERO, enabled: true },
    2: { ...DEFAULT_HERO, enabled: false },
  });
  const [uploading, setUploading] = useState<'image' | 'logo' | null>(null);
  const [pending, setPending] = useState<{ image?: { file: File; url: string }; logo?: { file: File; url: string } }>({});

  const { data: existing } = useQuery({
    queryKey: ['default-hero-overrides-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', [DEFAULT_HERO_OVERRIDES_KEY, DEFAULT_HERO_OVERRIDES_KEY_2]);
      if (error) throw error;
      const map: Record<string, DefaultHeroOverrides | null> = {};
      (data ?? []).forEach((row) => {
        try { map[row.key] = JSON.parse(row.value as unknown as string) as DefaultHeroOverrides; }
        catch { map[row.key] = null; }
      });
      return map;
    },
  });

  useEffect(() => {
    if (!existing) return;
    setStates((prev) => ({
      1: { ...prev[1], ...(existing[DEFAULT_HERO_OVERRIDES_KEY] ?? {}) },
      2: { ...prev[2], ...(existing[DEFAULT_HERO_OVERRIDES_KEY_2] ?? {}) },
    }));
  }, [existing]);

  const currentKey = activeVariant === 1 ? DEFAULT_HERO_OVERRIDES_KEY : DEFAULT_HERO_OVERRIDES_KEY_2;


  const state = states[activeVariant];
  const set = <K extends keyof HeroState>(k: K, v: HeroState[K]) =>
    setStates((s) => ({ ...s, [activeVariant]: { ...s[activeVariant], [k]: v } }));

  // Clear pending previews when switching variant
  useEffect(() => {
    setPending((p) => {
      if (p.image) URL.revokeObjectURL(p.image.url);
      if (p.logo) URL.revokeObjectURL(p.logo.url);
      return {};
    });
  }, [activeVariant]);

  const pickFile = (kind: 'image' | 'logo', rawFile: File) => {
    setPending((p) => {
      const prev = p[kind];
      if (prev) URL.revokeObjectURL(prev.url);
      return { ...p, [kind]: { file: rawFile, url: URL.createObjectURL(rawFile) } };
    });
  };

  const cancelPending = (kind: 'image' | 'logo') => {
    setPending((p) => {
      const prev = p[kind];
      if (prev) URL.revokeObjectURL(prev.url);
      const { [kind]: _, ...rest } = p;
      return rest;
    });
  };

  const confirmUpload = async (kind: 'image' | 'logo') => {
    const item = pending[kind];
    if (!item) return;
    setUploading(kind);
    try {
      const rawFile = item.file;
      const file = rawFile.type === 'image/svg+xml'
        ? rawFile
        : await optimizeImage(rawFile, {
            maxDimension: kind === 'image' ? 1600 : 400,
            quality: 0.85,
          });
      const ext = file.name.split('.').pop() || 'webp';
      const path = `hero/default-v${activeVariant}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from('site-assets')
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('site-assets').getPublicUrl(path);
      if (kind === 'image') set('image_url', data.publicUrl);
      else set('card_logo_url', data.publicUrl);
      cancelPending(kind);
      toast.success('Imatge pujada. Recorda desar els canvis.');
    } catch (e) {
      console.error(e);
      toast.error('Error pujant la imatge');
    } finally {
      setUploading(null);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const value = JSON.stringify(state);
      const { error } = await supabase
        .from('site_settings')
        .upsert({ key: currentKey, value }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['default-hero-overrides-all'] });
      qc.invalidateQueries({ queryKey: ['default-hero-variants-public'] });
      toast.success('Portada desada');
    },
    onError: (e) => { console.error(e); toast.error('Error desant'); },
  });

  const reset = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('site_settings')
        .delete()
        .eq('key', currentKey);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['default-hero-overrides-all'] });
      qc.invalidateQueries({ queryKey: ['default-hero-variants-public'] });
      setStates((s) => ({
        ...s,
        [activeVariant]: { ...DEFAULT_HERO, enabled: activeVariant === 1 },
      }));
      toast.success('Portada restaurada als valors originals');
    },
    onError: (e) => { console.error(e); toast.error('Error restaurant'); },
  });

  return (
    <div className="max-w-[1500px] mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Portada (Hero)</h1>
          <p className="text-muted-foreground text-sm">
            Edita els elements de la portada. Si actives 2 variants, es mostraran alternant-se cada 10 segons.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => { if (confirm('Restaurar els valors originals d\'aquesta variant?')) reset.mutate(); }}
            disabled={reset.isPending}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" /> Restaurar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
            <Save className="h-4 w-4" /> {save.isPending ? 'Desant...' : 'Desar'}
          </Button>
        </div>
      </div>

      {/* Variant tabs */}
      <div className="flex items-center gap-2 mb-4 border-b border-border">
        {VARIANTS.map((v) => {
          const active = v.id === activeVariant;
          const isEnabled = states[v.id].enabled !== false;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setActiveVariant(v.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {v.label}
              <span
                className={`ml-2 inline-block w-2 h-2 rounded-full ${isEnabled ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
                title={isEnabled ? 'Activa' : 'Desactivada'}
              />
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        <div className="space-y-6">
          {/* Enable toggle */}
          <div className="bg-card border border-border rounded-lg p-4">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div>
                <div className="font-display font-semibold text-sm">Variant activa</div>
                <div className="text-xs text-muted-foreground">
                  {activeVariant === 1
                    ? 'La variant 1 sempre es mostra si està activada.'
                    : 'Si està activada, s\'alternarà amb la variant 1 cada 10 segons.'}
                </div>
              </div>
              <input
                type="checkbox"
                checked={state.enabled !== false}
                onChange={(e) => set('enabled', e.target.checked)}
                className="h-5 w-5"
              />
            </label>
          </div>

          {/* LEFT BLOCK */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="font-display font-semibold">Bloc de l'esquerra</div>

            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Eyebrow (CA)</Label><Input value={state.eyebrow_ca} onChange={(e) => set('eyebrow_ca', e.target.value)} /></div>
              <div><Label className="text-xs">Eyebrow (ES)</Label><Input value={state.eyebrow_es} onChange={(e) => set('eyebrow_es', e.target.value)} /></div>
            </div>
            <div>
              <Label className="text-xs">Mida eyebrow (px) · 0 = per defecte</Label>
              <Input type="number" min={0} max={120} value={state.eyebrow_size}
                onChange={(e) => set('eyebrow_size', Number(e.target.value) || 0)} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Títol (CA)</Label><Textarea rows={2} value={state.title_ca} onChange={(e) => set('title_ca', e.target.value)} /></div>
              <div><Label className="text-xs">Títol (ES)</Label><Textarea rows={2} value={state.title_es} onChange={(e) => set('title_es', e.target.value)} /></div>
            </div>
            <div>
              <Label className="text-xs">Mida títol (px) · 0 = per defecte</Label>
              <Input type="number" min={0} max={160} value={state.title_size}
                onChange={(e) => set('title_size', Number(e.target.value) || 0)} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Subtítol (CA)</Label><Textarea rows={3} value={state.subtitle_ca} onChange={(e) => set('subtitle_ca', e.target.value)} /></div>
              <div><Label className="text-xs">Subtítol (ES)</Label><Textarea rows={3} value={state.subtitle_es} onChange={(e) => set('subtitle_es', e.target.value)} /></div>
            </div>
            <div>
              <Label className="text-xs">Mida subtítol (px) · 0 = per defecte</Label>
              <Input type="number" min={0} max={80} value={state.subtitle_size}
                onChange={(e) => set('subtitle_size', Number(e.target.value) || 0)} />
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">Botó 1</div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Text (CA)</Label><Input value={state.button1_text_ca} onChange={(e) => set('button1_text_ca', e.target.value)} /></div>
                <div><Label className="text-xs">Text (ES)</Label><Input value={state.button1_text_es} onChange={(e) => set('button1_text_es', e.target.value)} /></div>
              </div>
              <div><Label className="text-xs">Enllaç</Label><Input value={state.button1_url} onChange={(e) => set('button1_url', e.target.value)} placeholder="/cataleg" /></div>
              <div>
                <Label className="text-xs">Mida botó (px) · 0 = per defecte</Label>
                <Input type="number" min={0} max={60} value={state.button1_size}
                  onChange={(e) => set('button1_size', Number(e.target.value) || 0)} />
              </div>
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">Botó 2</div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Text (CA)</Label><Input value={state.button2_text_ca} onChange={(e) => set('button2_text_ca', e.target.value)} /></div>
                <div><Label className="text-xs">Text (ES)</Label><Input value={state.button2_text_es} onChange={(e) => set('button2_text_es', e.target.value)} /></div>
              </div>
              <div><Label className="text-xs">Enllaç</Label><Input value={state.button2_url} onChange={(e) => set('button2_url', e.target.value)} placeholder="/llista-naixement" /></div>
              <div>
                <Label className="text-xs">Mida botó (px) · 0 = per defecte</Label>
                <Input type="number" min={0} max={60} value={state.button2_size}
                  onChange={(e) => set('button2_size', Number(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          {/* RIGHT BLOCK */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="font-display font-semibold">Bloc de la dreta</div>

            <div>
              <Label className="text-xs mb-1 block">Imatge principal</Label>
              {(pending.image || state.image_url) && (
                <div className="mb-2 relative aspect-video rounded overflow-hidden border border-border">
                  <img src={pending.image?.url ?? state.image_url ?? ''} alt="" className="w-full h-full object-cover" />
                  {pending.image && (
                    <div className="absolute top-2 left-2 bg-amber-500/95 text-white text-[10px] font-semibold px-2 py-0.5 rounded">
                      VISTA PRÈVIA — sense pujar
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <label className="inline-flex items-center gap-2 cursor-pointer text-sm px-3 py-2 rounded-md border border-border hover:bg-muted">
                  <Upload className="h-4 w-4" />
                  {state.image_url || pending.image ? 'Triar una altra' : 'Triar imatge'}
                  <input
                    type="file" accept="image/*" className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) { pickFile('image', e.target.files[0]); e.target.value = ''; } }}
                  />
                </label>
                {pending.image && (
                  <>
                    <Button size="sm" onClick={() => confirmUpload('image')} disabled={uploading === 'image'}>
                      {uploading === 'image' ? 'Pujant...' : 'Confirmar i pujar'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => cancelPending('image')} disabled={uploading === 'image'}>
                      Cancel·lar
                    </Button>
                  </>
                )}
                {!pending.image && state.image_url && (
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => set('image_url', null)}>
                    Treure
                  </Button>
                )}
              </div>
            </div>


            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Proporció</Label>
                <select
                  value={state.image_aspect}
                  onChange={(e) => set('image_aspect', e.target.value as typeof state.image_aspect)}
                  className="w-full h-9 rounded border border-input bg-background px-2 text-sm"
                >
                  {ASPECTS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs">Format imatge</Label>
                <select
                  value={state.image_object_fit}
                  onChange={(e) => set('image_object_fit', e.target.value as 'cover' | 'contain')}
                  className="w-full h-9 rounded border border-input bg-background px-2 text-sm"
                >
                  <option value="cover">Omplir (cover)</option>
                  <option value="contain">Encaixar (contain)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Amplada màx. (px)</Label>
                <Input
                  type="number" min={320} max={800}
                  value={state.image_max_width}
                  onChange={(e) => set('image_max_width', Number(e.target.value) || 560)}
                />
              </div>
              <div>
                <Label className="text-xs">Cantonades (px)</Label>
                <Input
                  type="number" min={0} max={80}
                  value={state.image_radius}
                  onChange={(e) => set('image_radius', Number(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-muted-foreground">Targeta inferior (logo + text)</div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={state.card_visible}
                    onChange={(e) => set('card_visible', e.target.checked)}
                  />
                  Visible
                </label>
              </div>

              <div>
                <Label className="text-xs mb-1 block">Logo</Label>
                {(pending.logo || state.card_logo_url) && (
                  <div className="mb-2 flex items-center gap-2">
                    <div className="w-14 h-14 rounded-full overflow-hidden border border-border">
                      <img src={pending.logo?.url ?? state.card_logo_url ?? ''} alt="" className="w-full h-full object-cover" />
                    </div>
                    {pending.logo && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/95 text-white">
                        VISTA PRÈVIA
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm px-3 py-2 rounded-md border border-border hover:bg-muted">
                    <Upload className="h-4 w-4" />
                    {state.card_logo_url || pending.logo ? 'Triar un altre' : 'Triar logo'}
                    <input
                      type="file" accept="image/*" className="hidden"
                      onChange={(e) => { if (e.target.files?.[0]) { pickFile('logo', e.target.files[0]); e.target.value = ''; } }}
                    />
                  </label>
                  {pending.logo && (
                    <>
                      <Button size="sm" onClick={() => confirmUpload('logo')} disabled={uploading === 'logo'}>
                        {uploading === 'logo' ? 'Pujant...' : 'Confirmar i pujar'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => cancelPending('logo')} disabled={uploading === 'logo'}>
                        Cancel·lar
                      </Button>
                    </>
                  )}
                  {!pending.logo && state.card_logo_url && (
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => set('card_logo_url', null)}>
                      Treure
                    </Button>
                  )}
                </div>
              </div>


              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Títol (CA)</Label><Input value={state.card_title_ca} onChange={(e) => set('card_title_ca', e.target.value)} /></div>
                <div><Label className="text-xs">Títol (ES)</Label><Input value={state.card_title_es} onChange={(e) => set('card_title_es', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Subtítol (CA)</Label><Input value={state.card_subtitle_ca} onChange={(e) => set('card_subtitle_ca', e.target.value)} /></div>
                <div><Label className="text-xs">Subtítol (ES)</Label><Input value={state.card_subtitle_es} onChange={(e) => set('card_subtitle_es', e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Mida títol targeta (px)</Label>
                  <Input type="number" min={0} max={60} value={state.card_title_size}
                    onChange={(e) => set('card_title_size', Number(e.target.value) || 0)} />
                </div>
                <div>
                  <Label className="text-xs">Mida subtítol targeta (px)</Label>
                  <Input type="number" min={0} max={60} value={state.card_subtitle_size}
                    onChange={(e) => set('card_subtitle_size', Number(e.target.value) || 0)} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden h-fit">
          <div className="text-sm font-semibold px-4 py-2 border-b border-border">
            Vista prèvia ({VARIANTS.find((v) => v.id === activeVariant)?.label})
          </div>
          <DefaultHero preview={state} />
        </div>
      </div>
    </div>
  );
};

export default AdminDefaultHeroForm;
