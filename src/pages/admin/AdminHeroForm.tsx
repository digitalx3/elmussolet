import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Save, Upload, Monitor, Tablet, Smartphone, Eye } from 'lucide-react';
import { toast } from 'sonner';
import HeroCanvasEditor, { defaultLayout, Layout, Device, FloatingImage, DEFAULT_FLOATING_BOX } from '@/components/admin/HeroCanvasEditor';
import HeroSlideView, { Slide } from '@/components/home/HeroSlideView';
import ImageUploader from '@/components/admin/ImageUploader';
import { Plus, Trash2 } from 'lucide-react';

const PREVIEW_WIDTHS: Record<Device, number> = { desktop: 1200, tablet: 768, mobile: 375 };

const BUTTON_VARIANTS = ['default', 'outline', 'secondary', 'ghost'];

const AdminHeroForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isNew = !id || id === 'nou';

  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const [overlay, setOverlay] = useState(0.2);
  const [badgeCa, setBadgeCa] = useState('');
  const [badgeEs, setBadgeEs] = useState('');
  const [titleCa, setTitleCa] = useState('');
  const [titleEs, setTitleEs] = useState('');
  const [subtitleCa, setSubtitleCa] = useState('');
  const [subtitleEs, setSubtitleEs] = useState('');
  const [btn1Ca, setBtn1Ca] = useState('');
  const [btn1Es, setBtn1Es] = useState('');
  const [btn1Url, setBtn1Url] = useState('');
  const [btn1Variant, setBtn1Variant] = useState('default');
  const [btn2Ca, setBtn2Ca] = useState('');
  const [btn2Es, setBtn2Es] = useState('');
  const [btn2Url, setBtn2Url] = useState('');
  const [btn2Variant, setBtn2Variant] = useState('outline');
  const [layout, setLayout] = useState<Layout>(defaultLayout());
  const [canvasHeights, setCanvasHeights] = useState<Record<Device, number>>({ desktop: 600, tablet: 520, mobile: 560 });
  const [uploading, setUploading] = useState(false);
  const [floatingImages, setFloatingImages] = useState<FloatingImage[]>([]);

  const { data: existing } = useQuery({
    queryKey: ['hero-slide', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('hero_slides').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !isNew,
  });

  useEffect(() => {
    if (!existing) return;
    setName(existing.name ?? '');
    setIsActive(!!existing.is_active);
    setBgUrl(existing.background_image_url ?? null);
    setOverlay(Number(existing.background_overlay ?? 0.2));
    setBadgeCa(existing.badge_text_ca ?? ''); setBadgeEs(existing.badge_text_es ?? '');
    setTitleCa(existing.title_ca ?? ''); setTitleEs(existing.title_es ?? '');
    setSubtitleCa(existing.subtitle_ca ?? ''); setSubtitleEs(existing.subtitle_es ?? '');
    setBtn1Ca(existing.button1_text_ca ?? ''); setBtn1Es(existing.button1_text_es ?? '');
    setBtn1Url(existing.button1_url ?? ''); setBtn1Variant(existing.button1_variant ?? 'default');
    setBtn2Ca(existing.button2_text_ca ?? ''); setBtn2Es(existing.button2_text_es ?? '');
    setBtn2Url(existing.button2_url ?? ''); setBtn2Variant(existing.button2_variant ?? 'outline');
    const lay = existing.layout as unknown as Layout | null;
    if (lay && lay.desktop) setLayout(lay);
    const ch = existing.canvas_heights as unknown as Record<Device, number> | null;
    if (ch) setCanvasHeights(ch);
    const fi = (existing as unknown as { floating_images?: FloatingImage[] }).floating_images;
    if (Array.isArray(fi)) setFloatingImages(fi);
  }, [existing]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `hero/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from('site-assets').upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('site-assets').getPublicUrl(path);
      setBgUrl(data.publicUrl);
      toast.success('Imatge pujada');
    } catch (e: unknown) {
      toast.error('Error pujant la imatge');
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        is_active: isActive,
        background_image_url: bgUrl,
        background_overlay: overlay,
        badge_text_ca: badgeCa || null, badge_text_es: badgeEs || null,
        title_ca: titleCa || null, title_es: titleEs || null,
        subtitle_ca: subtitleCa || null, subtitle_es: subtitleEs || null,
        button1_text_ca: btn1Ca || null, button1_text_es: btn1Es || null,
        button1_url: btn1Url || null, button1_variant: btn1Variant,
        button2_text_ca: btn2Ca || null, button2_text_es: btn2Es || null,
        button2_url: btn2Url || null, button2_variant: btn2Variant,
        layout: layout as never,
        canvas_heights: canvasHeights as never,
        floating_images: floatingImages as never,
      };
      if (isNew) {
        const { data: maxRow } = await supabase.from('hero_slides').select('sort_order').order('sort_order', { ascending: false }).limit(1).maybeSingle();
        const nextOrder = ((maxRow as { sort_order?: number } | null)?.sort_order ?? -1) + 1;
        const insertPayload = { ...payload, sort_order: nextOrder } as never;
        const { data, error } = await supabase.from('hero_slides').insert(insertPayload).select().single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await supabase.from('hero_slides').update(payload).eq('id', id!).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['hero-slides-admin'] });
      qc.invalidateQueries({ queryKey: ['hero-slides-public'] });
      toast.success('Desat correctament');
      if (isNew && data?.id) navigate(`/admin/heros/${data.id}`, { replace: true });
    },
    onError: (e) => { console.error(e); toast.error('Error desant'); },
  });

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/heros')} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Tornar
          </Button>
          <h1 className="font-display text-2xl font-bold">{isNew ? 'Nou hero' : `Editar: ${name || existing?.name || ''}`}</h1>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending || !name} className="gap-2">
          <Save className="h-4 w-4" /> {save.isPending ? 'Desant...' : 'Desar'}
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
        {/* Sidebar form */}
        <div className="space-y-5 bg-card p-4 rounded-lg border border-border h-fit">
          <div>
            <Label>Nom intern *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Promo estiu 2026" />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <Label htmlFor="active" className="cursor-pointer">Actiu al carrusel</Label>
          </div>

          <div className="border-t border-border pt-4">
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
              <div>
                <Label className="text-xs">Badge (CA)</Label>
                <Input value={badgeCa} onChange={(e) => setBadgeCa(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Badge (ES)</Label>
                <Input value={badgeEs} onChange={(e) => setBadgeEs(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Títol (CA)</Label>
                <Textarea value={titleCa} onChange={(e) => setTitleCa(e.target.value)} rows={2} />
              </div>
              <div>
                <Label className="text-xs">Títol (ES)</Label>
                <Textarea value={titleEs} onChange={(e) => setTitleEs(e.target.value)} rows={2} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Subtítol (CA)</Label>
                <Textarea value={subtitleCa} onChange={(e) => setSubtitleCa(e.target.value)} rows={2} />
              </div>
              <div>
                <Label className="text-xs">Subtítol (ES)</Label>
                <Textarea value={subtitleEs} onChange={(e) => setSubtitleEs(e.target.value)} rows={2} />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <div className="font-semibold text-sm">Botó 1</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Text (CA)</Label>
                <Input value={btn1Ca} onChange={(e) => setBtn1Ca(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Text (ES)</Label>
                <Input value={btn1Es} onChange={(e) => setBtn1Es(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Enllaç</Label>
              <Input value={btn1Url} onChange={(e) => setBtn1Url(e.target.value)} placeholder="/cataleg" />
            </div>
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
              <div>
                <Label className="text-xs">Text (CA)</Label>
                <Input value={btn2Ca} onChange={(e) => setBtn2Ca(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Text (ES)</Label>
                <Input value={btn2Es} onChange={(e) => setBtn2Es(e.target.value)} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Enllaç</Label>
              <Input value={btn2Url} onChange={(e) => setBtn2Url(e.target.value)} placeholder="/llista-naixement" />
            </div>
            <div>
              <Label className="text-xs">Estil</Label>
              <select value={btn2Variant} onChange={(e) => setBtn2Variant(e.target.value)} className="w-full h-9 rounded border border-input bg-background px-2 text-sm">
                {BUTTON_VARIANTS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="border-t border-border pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-sm">Imatges flotants</div>
              <Button type="button" variant="outline" size="sm" className="gap-1"
                onClick={() => {
                  const newId = Math.random().toString(36).slice(2, 10);
                  const nextZ = Math.max(0, ...floatingImages.map(f => f.zIndex)) + 1;
                  setFloatingImages([...floatingImages, {
                    id: newId, url: '', frame: 'white', rounded: 16, opacity: 1, zIndex: nextZ, rotation: 0,
                  }]);
                  setLayout({
                    ...layout,
                    desktop: { ...layout.desktop, [`img:${newId}`]: { ...DEFAULT_FLOATING_BOX } },
                    tablet:  { ...layout.tablet,  [`img:${newId}`]: { ...DEFAULT_FLOATING_BOX, x: 380, y: 80, w: 320, h: 320 } },
                    mobile:  { ...layout.mobile,  [`img:${newId}`]: { ...DEFAULT_FLOATING_BOX, x: 30,  y: 380, w: 315, h: 220 } },
                  });
                }}>
                <Plus className="h-3.5 w-3.5" /> Afegir
              </Button>
            </div>
            {floatingImages.length === 0 && (
              <p className="text-xs text-muted-foreground">Cap imatge flotant. Afegeix-ne per col·locar-la sobre el hero amb marc, capa, rotació…</p>
            )}
            {floatingImages.map((fi, idx) => (
              <div key={fi.id} className="rounded-md border border-border p-2 space-y-2 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Imatge {idx + 1}</span>
                  <Button type="button" variant="ghost" size="sm" className="text-destructive h-7 px-2"
                    onClick={() => {
                      setFloatingImages(floatingImages.filter(x => x.id !== fi.id));
                      const stripped: Layout = { ...layout };
                      (['desktop','tablet','mobile'] as Device[]).forEach(d => {
                        const copy = { ...stripped[d] };
                        delete copy[`img:${fi.id}`];
                        stripped[d] = copy;
                      });
                      setLayout(stripped);
                    }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <ImageUploader
                  value={fi.url}
                  onChange={(url) => setFloatingImages(floatingImages.map(x => x.id === fi.id ? { ...x, url } : x))}
                  pathPrefix="hero/floating"
                  previewClassName="h-20"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Marc</Label>
                    <select value={fi.frame}
                      onChange={(e) => setFloatingImages(floatingImages.map(x => x.id === fi.id ? { ...x, frame: e.target.value as FloatingImage['frame'] } : x))}
                      className="w-full h-8 text-xs rounded border border-input bg-background px-2">
                      <option value="none">Sense</option>
                      <option value="white">Marc blanc</option>
                      <option value="shadow">Ombra</option>
                      <option value="polaroid">Polaroid</option>
                      <option value="rounded">Arrodonida</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Capa (z)</Label>
                    <Input type="number" value={fi.zIndex} className="h-8 text-xs"
                      onChange={(e) => setFloatingImages(floatingImages.map(x => x.id === fi.id ? { ...x, zIndex: parseInt(e.target.value) || 0 } : x))} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Canvas editor */}
        <div className="bg-card p-4 rounded-lg border border-border">
          <HeroCanvasEditor
            layout={layout}
            onLayoutChange={setLayout}
            canvasHeights={canvasHeights}
            onCanvasHeightsChange={setCanvasHeights}
            backgroundUrl={bgUrl}
            overlay={overlay}
            content={{
              badge: badgeCa || badgeEs,
              title: titleCa || titleEs,
              subtitle: subtitleCa || subtitleEs,
              button1: btn1Ca || btn1Es,
              button2: btn2Ca || btn2Es,
            }}
            floatingImages={floatingImages}
            onFloatingImageUpdate={(fid, patch) =>
              setFloatingImages(floatingImages.map(x => x.id === fid ? { ...x, ...patch } : x))
            }
          />
          <p className="text-xs text-muted-foreground mt-3">
            Arrossega i redimensiona els elements directament sobre la imatge. Configura cada dispositiu (PC / Tablet / Mòbil) per separat.
          </p>

          <LivePreview
            bgUrl={bgUrl}
            overlay={overlay}
            badgeCa={badgeCa} badgeEs={badgeEs}
            titleCa={titleCa} titleEs={titleEs}
            subtitleCa={subtitleCa} subtitleEs={subtitleEs}
            btn1Ca={btn1Ca} btn1Es={btn1Es} btn1Url={btn1Url} btn1Variant={btn1Variant}
            btn2Ca={btn2Ca} btn2Es={btn2Es} btn2Url={btn2Url} btn2Variant={btn2Variant}
            layout={layout}
            canvasHeights={canvasHeights}
            floatingImages={floatingImages}
          />
        </div>

      </div>
    </div>
  );
};

interface LivePreviewProps {
  bgUrl: string | null;
  overlay: number;
  badgeCa: string; badgeEs: string;
  titleCa: string; titleEs: string;
  subtitleCa: string; subtitleEs: string;
  btn1Ca: string; btn1Es: string; btn1Url: string; btn1Variant: string;
  btn2Ca: string; btn2Es: string; btn2Url: string; btn2Variant: string;
  layout: Layout;
  canvasHeights: Record<Device, number>;
}

const LivePreview: React.FC<LivePreviewProps> = (p) => {
  const [device, setDevice] = useState<Device>('desktop');

  const slide: Slide = {
    background_image_url: p.bgUrl,
    background_overlay: p.overlay,
    badge_text_ca: p.badgeCa || null, badge_text_es: p.badgeEs || null,
    title_ca: p.titleCa || null, title_es: p.titleEs || null,
    subtitle_ca: p.subtitleCa || null, subtitle_es: p.subtitleEs || null,
    button1_text_ca: p.btn1Ca || null, button1_text_es: p.btn1Es || null,
    button1_url: p.btn1Url || null, button1_variant: p.btn1Variant,
    button2_text_ca: p.btn2Ca || null, button2_text_es: p.btn2Es || null,
    button2_url: p.btn2Url || null, button2_variant: p.btn2Variant,
    layout: p.layout,
    canvas_heights: p.canvasHeights,
  };

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">Vista prèvia en temps real</h3>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-muted p-1">
          {([
            ['desktop', Monitor, 'PC'],
            ['tablet', Tablet, 'Tablet'],
            ['mobile', Smartphone, 'Mòbil'],
          ] as const).map(([d, Icon, label]) => (
            <button
              key={d}
              type="button"
              onClick={() => setDevice(d)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                device === d ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-muted/30 rounded-lg p-4 overflow-auto">
        <div
          className="mx-auto bg-background rounded-lg overflow-hidden shadow-elevated border border-border"
          style={{ width: '100%', maxWidth: PREVIEW_WIDTHS[device] }}
        >
          <HeroSlideView slide={slide} device={device} interactive={false} />
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2">
          Tal com es veurà a la home — {device.toUpperCase()}
        </p>
      </div>
    </div>
  );
};

export default AdminHeroForm;
