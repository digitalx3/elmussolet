import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { optimizeImage } from '@/lib/optimizeImage';
import HeroSlideView, { Slide } from '@/components/home/HeroSlideView';
import {
  DEFAULT_HERO_OVERRIDES_KEY,
  createDefaultHeroSlide,
  baseDefaultHeroSlide,
  DefaultHeroOverrides,
} from '@/lib/defaultHeroSlide';

const BUTTON_VARIANTS = ['default', 'outline', 'secondary', 'ghost'];

const AdminDefaultHeroForm: React.FC = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const base = baseDefaultHeroSlide();

  const [bgUrl, setBgUrl] = useState<string | null>(base.background_image_url);
  const [overlay, setOverlay] = useState<number>(base.background_overlay);
  const [badgeCa, setBadgeCa] = useState(base.badge_text_ca);
  const [badgeEs, setBadgeEs] = useState(base.badge_text_es);
  const [titleCa, setTitleCa] = useState(base.title_ca);
  const [titleEs, setTitleEs] = useState(base.title_es);
  const [subtitleCa, setSubtitleCa] = useState(base.subtitle_ca);
  const [subtitleEs, setSubtitleEs] = useState(base.subtitle_es);
  const [btn1Ca, setBtn1Ca] = useState(base.button1_text_ca);
  const [btn1Es, setBtn1Es] = useState(base.button1_text_es);
  const [btn1Url, setBtn1Url] = useState(base.button1_url);
  const [btn1Variant, setBtn1Variant] = useState(base.button1_variant);
  const [btn2Ca, setBtn2Ca] = useState(base.button2_text_ca);
  const [btn2Es, setBtn2Es] = useState(base.button2_text_es);
  const [btn2Url, setBtn2Url] = useState(base.button2_url);
  const [btn2Variant, setBtn2Variant] = useState(base.button2_variant);
  const [uploading, setUploading] = useState(false);

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
      try {
        return JSON.parse(data.value as unknown as string) as DefaultHeroOverrides;
      } catch {
        return null;
      }
    },
  });

  useEffect(() => {
    if (!existing) return;
    if ('background_image_url' in existing) setBgUrl(existing.background_image_url ?? null);
    if (existing.background_overlay !== undefined) setOverlay(Number(existing.background_overlay));
    if (existing.badge_text_ca !== undefined) setBadgeCa(existing.badge_text_ca);
    if (existing.badge_text_es !== undefined) setBadgeEs(existing.badge_text_es);
    if (existing.title_ca !== undefined) setTitleCa(existing.title_ca);
    if (existing.title_es !== undefined) setTitleEs(existing.title_es);
    if (existing.subtitle_ca !== undefined) setSubtitleCa(existing.subtitle_ca);
    if (existing.subtitle_es !== undefined) setSubtitleEs(existing.subtitle_es);
    if (existing.button1_text_ca !== undefined) setBtn1Ca(existing.button1_text_ca);
    if (existing.button1_text_es !== undefined) setBtn1Es(existing.button1_text_es);
    if (existing.button1_url !== undefined) setBtn1Url(existing.button1_url);
    if (existing.button1_variant !== undefined) setBtn1Variant(existing.button1_variant);
    if (existing.button2_text_ca !== undefined) setBtn2Ca(existing.button2_text_ca);
    if (existing.button2_text_es !== undefined) setBtn2Es(existing.button2_text_es);
    if (existing.button2_url !== undefined) setBtn2Url(existing.button2_url);
    if (existing.button2_variant !== undefined) setBtn2Variant(existing.button2_variant);
  }, [existing]);

  const handleUpload = async (rawFile: File) => {
    setUploading(true);
    try {
      const file = rawFile.type === 'image/svg+xml'
        ? rawFile
        : await optimizeImage(rawFile, { maxDimension: 1920, quality: 0.85 });
      const ext = file.name.split('.').pop() || 'webp';
      const path = `hero/default/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from('site-assets')
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('site-assets').getPublicUrl(path);
      setBgUrl(data.publicUrl);
      toast.success('Imatge pujada');
    } catch (e) {
      console.error(e);
      toast.error('Error pujant la imatge');
    } finally {
      setUploading(false);
    }
  };

  const buildOverrides = (): DefaultHeroOverrides => ({
    background_image_url: bgUrl,
    background_overlay: overlay,
    badge_text_ca: badgeCa, badge_text_es: badgeEs,
    title_ca: titleCa, title_es: titleEs,
    subtitle_ca: subtitleCa, subtitle_es: subtitleEs,
    button1_text_ca: btn1Ca, button1_text_es: btn1Es,
    button1_url: btn1Url, button1_variant: btn1Variant,
    button2_text_ca: btn2Ca, button2_text_es: btn2Es,
    button2_url: btn2Url, button2_variant: btn2Variant,
  });

  const save = useMutation({
    mutationFn: async () => {
      const value = JSON.stringify(buildOverrides());
      const { error } = await supabase
        .from('site_settings')
        .upsert({ key: DEFAULT_HERO_OVERRIDES_KEY, value }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['default-hero-overrides'] });
      qc.invalidateQueries({ queryKey: ['hero-slides-public'] });
      toast.success('Portada per defecte desada');
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
      qc.invalidateQueries({ queryKey: ['hero-slides-public'] });
      // reset local state to base values
      setBgUrl(base.background_image_url);
      setOverlay(base.background_overlay);
      setBadgeCa(base.badge_text_ca); setBadgeEs(base.badge_text_es);
      setTitleCa(base.title_ca); setTitleEs(base.title_es);
      setSubtitleCa(base.subtitle_ca); setSubtitleEs(base.subtitle_es);
      setBtn1Ca(base.button1_text_ca); setBtn1Es(base.button1_text_es);
      setBtn1Url(base.button1_url); setBtn1Variant(base.button1_variant);
      setBtn2Ca(base.button2_text_ca); setBtn2Es(base.button2_text_es);
      setBtn2Url(base.button2_url); setBtn2Variant(base.button2_variant);
      toast.success('Portada per defecte restaurada');
    },
    onError: (e) => { console.error(e); toast.error('Error restaurant'); },
  });

  const previewSlide = createDefaultHeroSlide({
    id: 'preview-default',
    ...buildOverrides(),
  }) as unknown as Slide;

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/heros')} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Tornar
          </Button>
          <h1 className="font-display text-2xl font-bold">Editar portada per defecte</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { if (confirm('Restaurar la portada per defecte original?')) reset.mutate(); }} disabled={reset.isPending}>
            Restaurar original
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
            <Save className="h-4 w-4" /> {save.isPending ? 'Desant...' : 'Desar'}
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Aquesta és la portada que apareix al front-office quan no hi ha cap hero publicat. Pots editar la imatge, els textos i els botons. L'estructura, dimensions i distribució dels elements del carrusel no es poden modificar.
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
        <div className="space-y-5 bg-card p-4 rounded-lg border border-border h-fit">
          <div>
            <Label className="mb-2 block">Imatge de fons</Label>
            {bgUrl && (
              <div className="mb-2 relative aspect-video rounded overflow-hidden border border-border">
                <img src={bgUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm px-3 py-2 rounded-md border border-border hover:bg-muted">
              <Upload className="h-4 w-4" />
              {uploading ? 'Pujant...' : bgUrl ? 'Canviar imatge' : 'Pujar imatge'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
            </label>
            {bgUrl && (
              <Button variant="ghost" size="sm" className="ml-2 text-destructive" onClick={() => setBgUrl(null)}>
                Treure
              </Button>
            )}
            <div className="mt-3">
              <Label className="text-xs">Opacitat overlay fosc ({overlay.toFixed(2)})</Label>
              <input
                type="range" min={0} max={0.8} step={0.05}
                value={overlay}
                onChange={(e) => setOverlay(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <div className="font-semibold text-sm">Continguts</div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Badge (CA)</Label><Input value={badgeCa} onChange={(e) => setBadgeCa(e.target.value)} /></div>
              <div><Label className="text-xs">Badge (ES)</Label><Input value={badgeEs} onChange={(e) => setBadgeEs(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Títol (CA)</Label><Textarea value={titleCa} onChange={(e) => setTitleCa(e.target.value)} rows={2} /></div>
              <div><Label className="text-xs">Títol (ES)</Label><Textarea value={titleEs} onChange={(e) => setTitleEs(e.target.value)} rows={2} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Subtítol (CA)</Label><Textarea value={subtitleCa} onChange={(e) => setSubtitleCa(e.target.value)} rows={2} /></div>
              <div><Label className="text-xs">Subtítol (ES)</Label><Textarea value={subtitleEs} onChange={(e) => setSubtitleEs(e.target.value)} rows={2} /></div>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <div className="font-semibold text-sm">Botó 1</div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Text (CA)</Label><Input value={btn1Ca} onChange={(e) => setBtn1Ca(e.target.value)} /></div>
              <div><Label className="text-xs">Text (ES)</Label><Input value={btn1Es} onChange={(e) => setBtn1Es(e.target.value)} /></div>
            </div>
            <div><Label className="text-xs">Enllaç</Label><Input value={btn1Url} onChange={(e) => setBtn1Url(e.target.value)} /></div>
            <div>
              <Label className="text-xs">Estil</Label>
              <select value={btn1Variant} onChange={(e) => setBtn1Variant(e.target.value)} className="w-full h-9 rounded border border-input bg-background px-2 text-sm">
                {BUTTON_VARIANTS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <div className="font-semibold text-sm">Botó 2</div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Text (CA)</Label><Input value={btn2Ca} onChange={(e) => setBtn2Ca(e.target.value)} /></div>
              <div><Label className="text-xs">Text (ES)</Label><Input value={btn2Es} onChange={(e) => setBtn2Es(e.target.value)} /></div>
            </div>
            <div><Label className="text-xs">Enllaç</Label><Input value={btn2Url} onChange={(e) => setBtn2Url(e.target.value)} /></div>
            <div>
              <Label className="text-xs">Estil</Label>
              <select value={btn2Variant} onChange={(e) => setBtn2Variant(e.target.value)} className="w-full h-9 rounded border border-input bg-background px-2 text-sm">
                {BUTTON_VARIANTS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-card p-4 rounded-lg border border-border">
          <div className="text-sm font-semibold mb-3">Vista prèvia</div>
          <div className="rounded-md overflow-hidden border border-border">
            <HeroSlideView slide={previewSlide} device="desktop" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDefaultHeroForm;
