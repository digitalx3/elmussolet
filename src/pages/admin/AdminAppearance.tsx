import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Save, Loader2, Type, Code2, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { AppearanceConfig, ElementStyle } from '@/components/AppearanceInjector';
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

const DEFAULT: AppearanceConfig = {
  bodyFont: '',
  headingFont: '',
  loadGoogleFonts: '',
  elements: Object.fromEntries(ELEMENT_KEYS.map(e => [e.key, {} as ElementStyle])),
  customCss: '',
  customJsHead: '',
  customJsFooter: '',
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
      const { error } = await supabase
        .from('site_settings')
        .upsert({ key: 'appearance_config', value: JSON.stringify(cfg) }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-appearance'] });
      qc.invalidateQueries({ queryKey: ['appearance-config'] });
      toast.success('Aparença desada');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateEl = (key: string, patch: Partial<ElementStyle>) => {
    setCfg(prev => ({
      ...prev,
      elements: { ...(prev.elements ?? {}), [key]: { ...(prev.elements?.[key] ?? {}), ...patch } },
    }));
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

      <Tabs defaultValue="typography">
        <TabsList>
          <TabsTrigger value="typography"><Type className="h-4 w-4 mr-1" />Tipografia</TabsTrigger>
          <TabsTrigger value="code"><Code2 className="h-4 w-4 mr-1" />Codi personalitzat</TabsTrigger>
          <TabsTrigger value="classes"><Palette className="h-4 w-4 mr-1" />Classes &amp; ajuda</TabsTrigger>
        </TabsList>

        <TabsContent value="typography" className="space-y-6 mt-4">
          <div className="sticky top-14 z-20 -mx-2">
            <AppearancePreview config={cfg} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fonts globals</CardTitle>
              <CardDescription>
                Indica el nom exacte de la font. Si és una Google Font, afegeix-la a sota perquè es carregui.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Font del cos (body)</Label>
                  <Input placeholder="Ex: Inter" value={cfg.bodyFont ?? ''}
                    onChange={e => setCfg({ ...cfg, bodyFont: e.target.value })} />
                </div>
                <div>
                  <Label>Font dels títols (h1–h6)</Label>
                  <Input placeholder="Ex: Playfair Display" value={cfg.headingFont ?? ''}
                    onChange={e => setCfg({ ...cfg, headingFont: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Carregar Google Fonts</Label>
                <Input
                  placeholder="Ex: Inter:wght@400;600|Playfair+Display:wght@700"
                  value={cfg.loadGoogleFonts ?? ''}
                  onChange={e => setCfg({ ...cfg, loadGoogleFonts: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Separa diverses famílies amb "|". Exemple: <code>Inter:wght@400;600|Lora:wght@500</code>
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
                    <div className="grid sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      <div>
                        <Label className="text-xs">Font</Label>
                        <Input placeholder="Hereta" value={el.fontFamily ?? ''} onChange={e => updateEl(key, { fontFamily: e.target.value })} />
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
                          <Input placeholder="#222 o hsl(...)" value={el.color ?? ''} onChange={e => updateEl(key, { color: e.target.value })} />
                        </div>
                      </div>
                      <div>
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
                placeholder={`<!-- Exemple Google Analytics -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);} \n  gtag('js', new Date()); gtag('config', 'G-XXXX');\n</script>`}
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
                Ves a <strong>Pàgina d'inici</strong> i, a cada targeta (Enviament segur, Recollida botiga, Atenció…)
                trobaràs el camp <em>Classe CSS personalitzada</em>.
              </p>
              <p>Després pots fer servir-la al CSS personalitzat. Per exemple:</p>
              <pre className="bg-muted rounded p-3 text-xs overflow-x-auto">{`.bloc-enviament {\n  background: hsl(var(--accent));\n  border-radius: 1.5rem;\n}`}</pre>
              <p className="text-muted-foreground">
                Classes globals disponibles a tota la web: <code>body</code>, <code>h1</code>–<code>h6</code>,
                <code> .font-display</code>, <code>.container</code>, i les classes utilitàries de Tailwind.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminAppearance;
