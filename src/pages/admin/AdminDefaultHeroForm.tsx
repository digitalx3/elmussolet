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
import {
  DEFAULT_HERO,
  DEFAULT_HERO_OVERRIDES_KEY,
  DefaultHeroOverrides,
} from '@/lib/defaultHeroSlide';

const ASPECTS: DefaultHeroOverrides['image_aspect'][] = ['1/1', '4/5', '4/3', '3/4', '16/9'];

const AdminDefaultHeroForm: React.FC = () => {
  const qc = useQueryClient();
  const [state, setState] = useState<Required<typeof DEFAULT_HERO>>({ ...DEFAULT_HERO });
  const [uploading, setUploading] = useState<'image' | 'logo' | null>(null);

  const set = <K extends keyof typeof state>(k: K, v: (typeof state)[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const { data: existing } = useQuery({
    queryKey: ['default-hero-overrides'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', DEFAULT_HERO_OVERRIDES_KEY)
        .maybeSingle();
      if (error) throw error;
      if (!data?.value) return null;
      try { return JSON.parse(data.value as unknown as string) as DefaultHeroOverrides; }
      catch { return null; }
    },
  });

  useEffect(() => {
    if (!existing) return;
    setState((s) => ({ ...s, ...existing }));
  }, [existing]);

  const upload = async (kind: 'image' | 'logo', rawFile: File) => {
    setUploading(kind);
    try {
      const file = rawFile.type === 'image/svg+xml'
        ? rawFile
        : await optimizeImage(rawFile, {
            maxDimension: kind === 'image' ? 1600 : 400,
            quality: 0.85,
          });
      const ext = file.name.split('.').pop() || 'webp';
      const path = `hero/default/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from('site-assets')
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('site-assets').getPublicUrl(path);
      if (kind === 'image') set('image_url', data.publicUrl);
      else set('card_logo_url', data.publicUrl);
      toast.success('Imatge pujada');
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
        .upsert({ key: DEFAULT_HERO_OVERRIDES_KEY, value }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['default-hero-overrides'] });
      qc.invalidateQueries({ queryKey: ['default-hero-overrides-public'] });
      toast.success('Portada desada');
    },
    onError: (e) => { console.error(e); toast.error('Error desant'); },
  });

  const reset = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('site_settings')
        .delete()
        .eq('key', DEFAULT_HERO_OVERRIDES_KEY);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['default-hero-overrides'] });
      qc.invalidateQueries({ queryKey: ['default-hero-overrides-public'] });
      setState({ ...DEFAULT_HERO });
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
            Edita els elements de la portada. L'estructura i distribució no es poden modificar.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => { if (confirm('Restaurar els valors originals?')) reset.mutate(); }}
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

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6">
        <div className="space-y-6">
          {/* LEFT BLOCK */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="font-display font-semibold">Bloc de l'esquerra</div>

            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Eyebrow (CA)</Label><Input value={state.eyebrow_ca} onChange={(e) => set('eyebrow_ca', e.target.value)} /></div>
              <div><Label className="text-xs">Eyebrow (ES)</Label><Input value={state.eyebrow_es} onChange={(e) => set('eyebrow_es', e.target.value)} /></div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Títol (CA)</Label><Textarea rows={2} value={state.title_ca} onChange={(e) => set('title_ca', e.target.value)} /></div>
              <div><Label className="text-xs">Títol (ES)</Label><Textarea rows={2} value={state.title_es} onChange={(e) => set('title_es', e.target.value)} /></div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Subtítol (CA)</Label><Textarea rows={3} value={state.subtitle_ca} onChange={(e) => set('subtitle_ca', e.target.value)} /></div>
              <div><Label className="text-xs">Subtítol (ES)</Label><Textarea rows={3} value={state.subtitle_es} onChange={(e) => set('subtitle_es', e.target.value)} /></div>
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">Botó 1</div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Text (CA)</Label><Input value={state.button1_text_ca} onChange={(e) => set('button1_text_ca', e.target.value)} /></div>
                <div><Label className="text-xs">Text (ES)</Label><Input value={state.button1_text_es} onChange={(e) => set('button1_text_es', e.target.value)} /></div>
              </div>
              <div><Label className="text-xs">Enllaç</Label><Input value={state.button1_url} onChange={(e) => set('button1_url', e.target.value)} placeholder="/cataleg" /></div>
            </div>

            <div className="border-t border-border pt-3 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">Botó 2</div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Text (CA)</Label><Input value={state.button2_text_ca} onChange={(e) => set('button2_text_ca', e.target.value)} /></div>
                <div><Label className="text-xs">Text (ES)</Label><Input value={state.button2_text_es} onChange={(e) => set('button2_text_es', e.target.value)} /></div>
              </div>
              <div><Label className="text-xs">Enllaç</Label><Input value={state.button2_url} onChange={(e) => set('button2_url', e.target.value)} placeholder="/llista-naixement" /></div>
            </div>
          </div>

          {/* RIGHT BLOCK */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-3">
            <div className="font-display font-semibold">Bloc de la dreta</div>

            <div>
              <Label className="text-xs mb-1 block">Imatge principal</Label>
              {state.image_url && (
                <div className="mb-2 relative aspect-video rounded overflow-hidden border border-border">
                  <img src={state.image_url} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <label className="inline-flex items-center gap-2 cursor-pointer text-sm px-3 py-2 rounded-md border border-border hover:bg-muted">
                  <Upload className="h-4 w-4" />
                  {uploading === 'image' ? 'Pujant...' : state.image_url ? 'Canviar' : 'Pujar'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload('image', e.target.files[0])} />
                </label>
                {state.image_url && (
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
                {state.card_logo_url && (
                  <div className="mb-2 w-14 h-14 rounded-full overflow-hidden border border-border">
                    <img src={state.card_logo_url} alt="" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-sm px-3 py-2 rounded-md border border-border hover:bg-muted">
                    <Upload className="h-4 w-4" />
                    {uploading === 'logo' ? 'Pujant...' : state.card_logo_url ? 'Canviar' : 'Pujar'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload('logo', e.target.files[0])} />
                  </label>
                  {state.card_logo_url && (
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
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden h-fit">
          <div className="text-sm font-semibold px-4 py-2 border-b border-border">Vista prèvia</div>
          <DefaultHero preview={state} />
        </div>
      </div>
    </div>
  );
};

export default AdminDefaultHeroForm;
