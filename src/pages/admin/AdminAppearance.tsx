import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { notify } from '@/lib/notify';
import { Save, Loader2, Type, Code2, Palette, Paintbrush } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AppearanceConfig, ColorConfig, ElementStyle } from '@/components/AppearanceInjector';
import AppearancePreview from '@/components/admin/AppearancePreview';

const ELEMENT_KEYS: { key: string; label: string }[] = [
  { key: 'h1', label: 'Títol H1' },
  { key: 'h2', label: 'Títol H2' },
  { key: 'h3', label: 'Títol H3' },
  { key: 'h4', label: 'Títol H4' },
  { key: 'p', label: 'Paràgraf (p)' },
  { key: 'a', label: 'Enllaços (a)' },
];

const FONT_WEIGHTS = ['', '300', '400', '500', '600', '700', '800'];

// Popular Google Fonts grouped by usage. Each entry is { name, weights }.
const POPULAR_FONTS = [
  // Sans
  { name: 'Inter', weights: '300;400;500;600;700' },
  { name: 'Roboto', weights: '300;400;500;700' },
  { name: 'Open Sans', weights: '300;400;600;700' },
  { name: 'Lato', weights: '300;400;700;900' },
  { name: 'Montserrat', weights: '300;400;500;600;700;800' },
  { name: 'Poppins', weights: '300;400;500;600;700;800' },
  { name: 'Nunito', weights: '300;400;600;700;800' },
  { name: 'DM Sans', weights: '400;500;700' },
  { name: 'Work Sans', weights: '300;400;500;600;700' },
  { name: 'Quicksand', weights: '400;500;600;700' },
  { name: 'Manrope', weights: '300;400;500;600;700' },
  { name: 'Outfit', weights: '300;400;500;600;700' },
  // Serif
  { name: 'Playfair Display', weights: '400;500;600;700;800' },
  { name: 'Merriweather', weights: '300;400;700;900' },
  { name: 'Lora', weights: '400;500;600;700' },
  { name: 'Cormorant Garamond', weights: '400;500;600;700' },
  { name: 'PT Serif', weights: '400;700' },
  { name: 'EB Garamond', weights: '400;500;600;700' },
  { name: 'DM Serif Display', weights: '400' },
  // Display / handwritten
  { name: 'Caveat', weights: '400;500;600;700' },
  { name: 'Dancing Script', weights: '400;500;600;700' },
  { name: 'Pacifico', weights: '400' },
  { name: 'Sacramento', weights: '400' },
  { name: 'Great Vibes', weights: '400' },
];

const COLOR_FIELDS: { key: keyof ColorConfig; label: string; description: string }[] = [
  { key: 'primary', label: 'Primari', description: 'Color principal de marca (botons, links).' },
  { key: 'primaryForeground', label: 'Text sobre primari', description: 'Color del text dins de botons primaris.' },
  { key: 'secondary', label: 'Secundari', description: 'Color complementari (botons secundaris, fons suaus).' },
  { key: 'secondaryForeground', label: 'Text sobre secundari', description: '' },
  { key: 'accent', label: 'Accent', description: 'Color d\'èmfasi (badges, destacats).' },
  { key: 'accentForeground', label: 'Text sobre accent', description: '' },
  { key: 'background', label: 'Fons general', description: 'Color de fons de la pàgina.' },
  { key: 'foreground', label: 'Text general', description: 'Color del text del cos.' },
  { key: 'border', label: 'Vores', description: 'Color de les vores i separadors.' },
];

const DEFAULT: AppearanceConfig = {
  bodyFont: '',
  headingFont: '',
  loadGoogleFonts: '',
  colors: {},
  elements: Object.fromEntries(ELEMENT_KEYS.map(e => [e.key, {} as ElementStyle])),
  customCss: '',
  customJsHead: '',
  customJsFooter: '',
};

// Build a Google Fonts query for the selected body/heading fonts
function buildGoogleFontsString(body?: string, heading?: string, extra?: string): string {
  const items: string[] = [];
  const used = new Set<string>();
  for (const fontName of [body, heading]) {
    if (!fontName) continue;
    const f = POPULAR_FONTS.find(p => p.name.toLowerCase() === fontName.toLowerCase());
    if (!f) continue;
    if (used.has(f.name)) continue;
    used.add(f.name);
    items.push(`${f.name.replace(/\s+/g, '+')}:wght@${f.weights}`);
  }
  if (extra?.trim()) items.push(extra.trim());
  return items.join('|');
}

// Inline preview using the font itself
const FontSelect: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => {
  // Load fonts for the dropdown preview
  useEffect(() => {
    const id = 'admin-font-picker-preview';
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      const families = POPULAR_FONTS.map(f => `family=${f.name.replace(/\s+/g, '+')}:wght@400;600`).join('&');
      link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
      document.head.appendChild(link);
    }
  }, []);

  return (
    <div className="space-y-2">
      <select
        className="w-full border border-input rounded-md h-10 px-3 bg-background text-sm"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={value ? { fontFamily: `'${value}', system-ui, sans-serif` } : undefined}
      >
        <option value="">{placeholder ?? '— per defecte —'}</option>
        {POPULAR_FONTS.map(f => (
          <option key={f.name} value={f.name} style={{ fontFamily: `'${f.name}', system-ui` }}>
            {f.name}
          </option>
        ))}
      </select>
      {value && (
        <div className="border border-border rounded-md px-3 py-2 bg-muted/30">
          <div className="text-xs text-muted-foreground mb-0.5">Vista prèvia:</div>
          <div style={{ fontFamily: `'${value}', system-ui, sans-serif` }} className="text-base">
            The quick brown fox jumps · ¡Hola món!
          </div>
        </div>
      )}
    </div>
  );
};

const AdminAppearance: React.FC = () => {
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<AppearanceConfig>(DEFAULT);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-appearance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings').select('value').eq('key', 'appearance_config').maybeSingle();
      if (error) throw error;
      if (!data?.value) return DEFAULT;
      try { return { ...DEFAULT, ...JSON.parse(data.value) }; } catch { return DEFAULT; }
    },
  });

  useEffect(() => { if (data) setCfg(data); }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      // Auto-generate Google Fonts string from selected fonts + any extra
      const toSave: AppearanceConfig = {
        ...cfg,
        loadGoogleFonts: buildGoogleFontsString(cfg.bodyFont, cfg.headingFont, cfg.loadGoogleFonts),
      };
      const { error } = await supabase
        .from('site_settings')
        .upsert({ key: 'appearance_config', value: JSON.stringify(toSave) }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-appearance'] });
      qc.invalidateQueries({ queryKey: ['appearance-config'] });
      notify.success('Aparença desada');
    },
    onError: (e: any) => notify.error(e.message),
  });

  const updateEl = (key: string, patch: Partial<ElementStyle>) => {
    setCfg(prev => ({
      ...prev,
      elements: { ...(prev.elements ?? {}), [key]: { ...(prev.elements?.[key] ?? {}), ...patch } },
    }));
  };

  const updateColor = (key: keyof ColorConfig, value: string) => {
    setCfg(prev => ({ ...prev, colors: { ...(prev.colors ?? {}), [key]: value } }));
  };

  if (isLoading) return <Loader2 className="h-6 w-6 animate-spin" />;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Aparença</h1>
          <p className="text-sm text-muted-foreground">Tipografies, colors i codi personalitzat</p>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-1">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Desar
        </Button>
      </div>

      <Tabs defaultValue="colors">
        <TabsList>
          <TabsTrigger value="colors"><Paintbrush className="h-4 w-4 mr-1" />Colors</TabsTrigger>
          <TabsTrigger value="typography"><Type className="h-4 w-4 mr-1" />Tipografia</TabsTrigger>
          <TabsTrigger value="code"><Code2 className="h-4 w-4 mr-1" />Codi personalitzat</TabsTrigger>
          <TabsTrigger value="classes"><Palette className="h-4 w-4 mr-1" />Classes &amp; ajuda</TabsTrigger>
        </TabsList>

        {/* COLORS */}
        <TabsContent value="colors" className="space-y-6 mt-4">
          <div className="sticky top-14 z-20 -mx-2">
            <AppearancePreview config={cfg} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Paleta de colors</CardTitle>
              <CardDescription>
                Deixa un camp buit per mantenir el color per defecte del tema. Pots fer servir HEX (#aabbcc) o HSL.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              {COLOR_FIELDS.map(({ key, label, description }) => {
                const val = cfg.colors?.[key] ?? '';
                const hexForPicker = /^#?[0-9a-f]{6}$/i.test(val.replace('#', '')) ? (val.startsWith('#') ? val : `#${val}`) : '#888888';
                return (
                  <div key={key} className="border border-border rounded-lg p-3">
                    <Label className="text-sm font-semibold">{label}</Label>
                    {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
                    <div className="flex gap-2 mt-2">
                      <Input
                        type="color"
                        className="w-14 p-1 h-10 cursor-pointer"
                        value={hexForPicker}
                        onChange={e => updateColor(key, e.target.value)}
                      />
                      <Input
                        placeholder="#rrggbb o hsl(h s% l%)"
                        value={val}
                        onChange={e => updateColor(key, e.target.value)}
                      />
                      {val && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => updateColor(key, '')}>×</Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TYPOGRAPHY */}
        <TabsContent value="typography" className="space-y-6 mt-4">
          <div className="sticky top-14 z-20 -mx-2">
            <AppearancePreview config={cfg} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fonts globals</CardTitle>
              <CardDescription>
                Tria una font del llistat (es carrega automàticament des de Google Fonts).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Font del cos (body)</Label>
                  <FontSelect value={cfg.bodyFont ?? ''} onChange={v => setCfg({ ...cfg, bodyFont: v })} />
                </div>
                <div>
                  <Label>Font dels títols (h1–h6)</Label>
                  <FontSelect value={cfg.headingFont ?? ''} onChange={v => setCfg({ ...cfg, headingFont: v })} />
                </div>
              </div>
              <div>
                <Label>Fonts addicionals (avançat)</Label>
                <Input
                  placeholder="Ex: Bebas+Neue:wght@400|Source+Code+Pro:wght@500"
                  value={cfg.loadGoogleFonts ?? ''}
                  onChange={e => setCfg({ ...cfg, loadGoogleFonts: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Només cal si vols carregar fonts que no estan al desplegable. Separa amb "|".
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estils per element</CardTitle>
              <CardDescription>Deixa un camp buit per mantenir el valor per defecte.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {ELEMENT_KEYS.map(({ key, label }) => {
                const el = cfg.elements?.[key] ?? {};
                return (
                  <div key={key} className="border border-border rounded-lg p-4">
                    <div className="font-semibold mb-3">{label} <span className="text-xs font-mono text-muted-foreground">{key}</span></div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      <div className="lg:col-span-2">
                        <Label className="text-xs">Font</Label>
                        <FontSelect value={el.fontFamily ?? ''} onChange={v => updateEl(key, { fontFamily: v })} placeholder="Hereta del tema" />
                      </div>
                      <div>
                        <Label className="text-xs">Mida</Label>
                        <Input placeholder="Ex: 2rem" value={el.fontSize ?? ''} onChange={e => updateEl(key, { fontSize: e.target.value })} />
                      </div>
                      <div>
                        <Label className="text-xs">Pes</Label>
                        <select
                          className="w-full border border-input rounded-md h-10 px-3 bg-background text-sm"
                          value={el.fontWeight ?? ''}
                          onChange={e => updateEl(key, { fontWeight: e.target.value })}
                        >
                          {FONT_WEIGHTS.map(w => <option key={w} value={w}>{w || '— per defecte —'}</option>)}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Color</Label>
                        <div className="flex gap-2">
                          <Input type="color" className="w-12 p-1 h-10" value={el.color || '#000000'} onChange={e => updateEl(key, { color: e.target.value })} />
                          <Input placeholder="#222" value={el.color ?? ''} onChange={e => updateEl(key, { color: e.target.value })} />
                        </div>
                      </div>
                      <div className="sm:col-span-2 lg:col-span-1">
                        <Label className="text-xs">Espaiat lletres</Label>
                        <Input placeholder="Ex: 0.02em" value={el.letterSpacing ?? ''} onChange={e => updateEl(key, { letterSpacing: e.target.value })} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CODE */}
        <TabsContent value="code" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">CSS personalitzat</CardTitle>
              <CardDescription>S'injecta a la capçalera del lloc.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                className="font-mono text-xs min-h-[180px]"
                placeholder=".meva-classe { color: hsl(var(--primary)); }"
                value={cfg.customCss ?? ''}
                onChange={e => setCfg({ ...cfg, customCss: e.target.value })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">JavaScript a la capçalera</CardTitle>
              <CardDescription>
                Apte per a Google Analytics, Tag Manager, píxels, etc. Accepta codi JS pur o etiquetes <code>&lt;script&gt;</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                className="font-mono text-xs min-h-[180px]"
                placeholder={`<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>`}
                value={cfg.customJsHead ?? ''}
                onChange={e => setCfg({ ...cfg, customJsHead: e.target.value })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">JavaScript al peu</CardTitle>
              <CardDescription>S'injecta abans del tancament del body.</CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                className="font-mono text-xs min-h-[180px]"
                placeholder="// Chat widgets, etc."
                value={cfg.customJsFooter ?? ''}
                onChange={e => setCfg({ ...cfg, customJsFooter: e.target.value })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="classes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Classes personalitzades als blocs</CardTitle>
              <CardDescription>Pots assignar una classe CSS a cada bloc de la pàgina d'inici i fer-hi referència des del CSS personalitzat.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                Ves a <strong>Pàgina d'inici</strong> i, a cada targeta trobaràs el camp <em>Classe CSS personalitzada</em>.
              </p>
              <pre className="bg-muted rounded p-3 text-xs overflow-x-auto">{`.bloc-enviament {\n  background: hsl(var(--accent));\n  border-radius: 1.5rem;\n}`}</pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAppearance;
