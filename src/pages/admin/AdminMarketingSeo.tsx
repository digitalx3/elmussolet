import React from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Copy, ExternalLink, RefreshCw, Download, FileText } from 'lucide-react';
import { useLanguages } from '@/hooks/useLanguages';
import { notify } from '@/lib/notify';

const TYPE_KEYS = ['static', 'products', 'pages', 'categories', 'brands'] as const;
type TypeKey = (typeof TYPE_KEYS)[number];

const DEFAULT_HOST =
  typeof window !== 'undefined' ? window.location.origin : 'https://elmussolet.lovable.app';

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sitemap`;
const ROBOTS_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/robots`;

const AdminMarketingSeo: React.FC = () => {
  const { t } = useTranslation();
  const { data: languages = [] } = useLanguages({ onlyEnabled: true });
  const [selected, setSelected] = React.useState<Record<TypeKey, boolean>>({
    static: true,
    products: true,
    pages: true,
    categories: true,
    brands: true,
  });
  const [host, setHost] = React.useState<string>(DEFAULT_HOST);
  const [tick, setTick] = React.useState(0);

  const activeTypes = TYPE_KEYS.filter((k) => selected[k]);

  const buildUrl = (lang: string) => {
    const params = new URLSearchParams({
      lang,
      host: host.replace(/\/$/, ''),
      types: activeTypes.join(','),
      v: String(tick),
    });
    return `${FUNCTIONS_BASE}?${params.toString()}`;
  };

  const buildIndexUrl = () => {
    const params = new URLSearchParams({
      index: '1',
      host: host.replace(/\/$/, ''),
      types: activeTypes.join(','),
      v: String(tick),
    });
    return `${FUNCTIONS_BASE}?${params.toString()}`;
  };

  const buildRobotsUrl = (lang?: string) => {
    const params = new URLSearchParams({
      host: host.replace(/\/$/, ''),
      v: String(tick),
    });
    if (lang) params.set('lang', lang);
    return `${ROBOTS_BASE}?${params.toString()}`;
  };

  const [robotsPreview, setRobotsPreview] = React.useState<string>('');
  const [robotsLoading, setRobotsLoading] = React.useState<boolean>(false);

  const fetchRobots = async (lang?: string) => {
    setRobotsLoading(true);
    try {
      const res = await fetch(buildRobotsUrl(lang));
      const text = await res.text();
      setRobotsPreview(text);
      return text;
    } catch (e) {
      notify.error(t('common.error', 'Error'));
      return '';
    } finally {
      setRobotsLoading(false);
    }
  };

  const downloadRobots = async (lang?: string) => {
    const text = await fetchRobots(lang);
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = lang ? `robots.${lang}.txt` : 'robots.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify.success(t('admin.seo.copied', 'Enllaç copiat'));
    } catch {
      notify.error(t('common.error', 'Error'));
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <Helmet>
        <title>{t('admin.marketingSeo', 'Marketing i SEO')} · Admin</title>
      </Helmet>

      <div>
        <h1 className="font-display text-2xl font-bold">{t('admin.marketingSeo', 'Marketing i SEO')}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t(
            'admin.seo.intro',
            'Genera sitemaps per idioma per pujar a Google Search Console. Les llistes de naixement queden sempre excloses.',
          )}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.seo.configTitle', 'Configuració del sitemap')}</CardTitle>
          <CardDescription>
            {t('admin.seo.configDesc', 'Selecciona quin tipus de pàgines vols incloure.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="host">{t('admin.seo.host', 'URL base del lloc')}</Label>
            <Input id="host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="https://..." />
            <p className="text-xs text-muted-foreground">
              {t('admin.seo.hostHelp', "Domini públic on s'allotja la botiga (sense barra final).")}
            </p>
          </div>

          <div className="space-y-3">
            <Label>{t('admin.seo.includeTypes', 'Contingut a incloure')}</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {TYPE_KEYS.map((k) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selected[k]}
                    onCheckedChange={(v) => setSelected((s) => ({ ...s, [k]: !!v }))}
                  />
                  <span className="text-sm">{t(`admin.seo.type_${k}`, k)}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('admin.seo.privacyNote', 'Les llistes de naixement no s’inclouen mai (són privades).')}
            </p>
          </div>

          <Button variant="outline" size="sm" onClick={() => setTick((n) => n + 1)} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {t('admin.seo.regenerate', 'Regenerar enllaços')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.seo.urlsTitle', 'Enllaços per idioma')}</CardTitle>
          <CardDescription>
            {t(
              'admin.seo.urlsDesc',
              "Copia cada enllaç i afegeix-lo com a sitemap a Google Search Console (un per idioma).",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeTypes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t('admin.seo.noTypes', 'Selecciona almenys un tipus de contingut.')}
            </p>
          )}
          {activeTypes.length > 0 && (() => {
            const indexUrl = buildIndexUrl();
            return (
              <div className="rounded-md border-2 border-primary/40 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">
                      {t('admin.seo.indexTitle', 'Sitemap index (recomanat)')}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t(
                        'admin.seo.indexDesc',
                        'Un únic enllaç que llista tots els sitemaps per idioma. Puja només aquest a Google Search Console.',
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => copy(indexUrl)} className="gap-1">
                      <Copy className="h-4 w-4" />
                      {t('admin.seo.copy', 'Copiar')}
                    </Button>
                    <Button size="sm" variant="outline" asChild className="gap-1">
                      <a href={indexUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        {t('admin.seo.open', 'Obrir')}
                      </a>
                    </Button>
                  </div>
                </div>
                <div className="text-xs bg-background p-2 rounded font-mono break-all">{indexUrl}</div>
              </div>
            );
          })()}
          {activeTypes.length > 0 &&
            languages.map((lng) => {
              const url = buildUrl(lng.code);
              return (
                <div key={lng.code} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm">
                        {lng.native_name} ({lng.code})
                      </div>
                      <div className="text-xs text-muted-foreground">sitemap-{lng.code}.xml</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => copy(url)} className="gap-1">
                        <Copy className="h-4 w-4" />
                        {t('admin.seo.copy', 'Copiar')}
                      </Button>
                      <Button size="sm" variant="outline" asChild className="gap-1">
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          {t('admin.seo.open', 'Obrir')}
                        </a>
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs bg-muted p-2 rounded font-mono break-all">{url}</div>
                </div>
              );
            })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('admin.seo.robotsTitle', 'robots.txt')}
          </CardTitle>
          <CardDescription>
            {t(
              'admin.seo.robotsDesc',
              'Genera el robots.txt amb la directiva Sitemap i bloqueja les llistes privades, comptes, cistella, checkout i admin. Disponible global i per idioma.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border-2 border-primary/40 bg-primary/5 p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium text-sm">
                  {t('admin.seo.robotsGlobal', 'robots.txt global (totes les llengües)')}
                </div>
                <div className="text-xs text-muted-foreground">/robots.txt</div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => fetchRobots()} disabled={robotsLoading} className="gap-1">
                  <RefreshCw className="h-4 w-4" />
                  {t('admin.seo.previewRobots', 'Previsualitzar')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => copy(buildRobotsUrl())} className="gap-1">
                  <Copy className="h-4 w-4" />
                  {t('admin.seo.copy', 'Copiar')}
                </Button>
                <Button size="sm" onClick={() => downloadRobots()} disabled={robotsLoading} className="gap-1">
                  <Download className="h-4 w-4" />
                  {t('admin.seo.downloadRobots', 'Descarregar robots.txt')}
                </Button>
              </div>
            </div>
            <div className="text-xs bg-background p-2 rounded font-mono break-all">{buildRobotsUrl()}</div>
            <p className="text-xs text-muted-foreground">
              {t(
                'admin.seo.robotsSaveHint',
                "Descarrega el fitxer i substitueix public/robots.txt al projecte perquè es publiqui a l'arrel del domini.",
              )}
            </p>
          </div>

          {languages.map((lng) => {
            const u = buildRobotsUrl(lng.code);
            return (
              <div key={`r-${lng.code}`} className="rounded-md border p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">
                      {lng.native_name} ({lng.code})
                    </div>
                    <div className="text-xs text-muted-foreground">/{lng.code}/robots.txt</div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => fetchRobots(lng.code)} disabled={robotsLoading} className="gap-1">
                      <RefreshCw className="h-4 w-4" />
                      {t('admin.seo.previewRobots', 'Previsualitzar')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => copy(u)} className="gap-1">
                      <Copy className="h-4 w-4" />
                      {t('admin.seo.copy', 'Copiar')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => downloadRobots(lng.code)} disabled={robotsLoading} className="gap-1">
                      <Download className="h-4 w-4" />
                      {t('admin.seo.download', 'Descarregar')}
                    </Button>
                    <Button size="sm" variant="outline" asChild className="gap-1">
                      <a href={u} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        {t('admin.seo.open', 'Obrir')}
                      </a>
                    </Button>
                  </div>
                </div>
                <div className="text-xs bg-muted p-2 rounded font-mono break-all">{u}</div>
              </div>
            );
          })}

          {robotsPreview && (
            <div>
              <Label className="text-xs">{t('admin.seo.robotsPreview', 'Previsualització')}</Label>
              <pre className="mt-1 text-xs bg-muted p-3 rounded max-h-80 overflow-auto whitespace-pre-wrap">
{robotsPreview}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMarketingSeo;
