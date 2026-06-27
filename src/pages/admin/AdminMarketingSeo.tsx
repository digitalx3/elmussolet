import React from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, ExternalLink, FileText, Map as MapIcon, RefreshCw } from 'lucide-react';
import { useLanguages } from '@/hooks/useLanguages';
import { notify } from '@/lib/notify';
import { supabase } from '@/integrations/supabase/client';

const DEFAULT_HOST =
  typeof window !== 'undefined' ? window.location.origin : 'https://elmussolet.lovable.app';

type RegenResult = {
  ok: boolean;
  generated_at: string;
  regenerated?: string[];
  robots: string;
  sitemapIndex: string;
  sitemaps: { lang: string; url: string }[];
};

// Map a returned storage path to a stable key used for per-file timestamps.
const pathToKey = (p: string): string | null => {
  if (p.endsWith('robots.txt')) return 'robots';
  if (p.endsWith('sitemap.xml')) return 'sitemap-index';
  const m = p.match(/sitemap-([a-z-]+)\.xml$/i);
  return m ? `sitemap-${m[1]}` : null;
};

const AdminMarketingSeo: React.FC = () => {
  const { t } = useTranslation();
  const { data: languages = [] } = useLanguages({ onlyEnabled: true });
  const [host, setHost] = React.useState<string>(DEFAULT_HOST);
  const [regenBusy, setRegenBusy] = React.useState<string | null>(null);
  const [live, setLive] = React.useState<RegenResult | null>(null);
  const [stamps, setStamps] = React.useState<Record<string, string>>({});

  const base = host.replace(/\/$/, '');
  const robotsUrl = `${base}/robots.txt`;
  const sitemapIndexUrl = `${base}/sitemap.xml`;
  const sitemapLangUrl = (code: string) => `${base}/sitemap-${code}.xml`;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      notify.success(t('admin.seo.copied', 'Enllaç copiat'));
    } catch {
      notify.error(t('common.error', 'Error'));
    }
  };

  type Targets = { robots?: boolean; sitemapIndex?: boolean; langs?: string[] | 'all' };
  const regenerate = async (busyKey: string, targets?: Targets) => {
    setRegenBusy(busyKey);
    try {
      const { data, error } = await supabase.functions.invoke('regenerate-seo', {
        body: targets ? { host: base, targets } : { host: base },
      });
      if (error || !data?.ok) throw new Error(error?.message || 'failed');
      const result = data as RegenResult;
      setLive(result);
      const ts = result.generated_at;
      setStamps((prev) => {
        const next = { ...prev };
        for (const p of result.regenerated || []) {
          const k = pathToKey(p);
          if (k) next[k] = ts;
        }
        return next;
      });
      notify.success(t('admin.seo.regenerated', 'Fitxers regenerats correctament'));
    } catch (e: any) {
      notify.error(e?.message || t('common.error', 'Error'));
    } finally {
      setRegenBusy(null);
    }
  };
  const regenerating = regenBusy !== null;


  const UrlRow: React.FC<{
    title: string;
    subtitle?: string;
    url: string;
    primary?: boolean;
    stampKey?: string;
  }> = ({ title, subtitle, url, primary, stampKey }) => {
    const stamp = stampKey ? stamps[stampKey] : undefined;
    return (
      <div
        className={`rounded-md p-3 space-y-2 ${
          primary ? 'border-2 border-primary/40 bg-primary/5' : 'border'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-medium text-sm">{title}</div>
            {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
            {stamp && (
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {t('admin.seo.regenAt', 'Última regeneració:')}{' '}
                {new Date(stamp).toLocaleString()}
              </div>
            )}
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
        <div className={`text-xs ${primary ? 'bg-background' : 'bg-muted'} p-2 rounded font-mono break-all`}>
          {url}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <Helmet>
        <title>{t('admin.marketingSeo', 'Marketing i SEO')} · Admin</title>
      </Helmet>

      <div>
        <h1 className="font-display text-2xl font-bold">
          {t('admin.marketingSeo', 'Marketing i SEO')}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {t(
            'admin.seo.intro',
            'Els fitxers robots.txt i sitemap.xml es publiquen automàticament a l’arrel del domini. Es regeneren a cada desplegament amb el contingut actiu de la botiga. Les llistes de naixement queden sempre excloses.',
          )}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.seo.host', 'URL base del lloc')}</CardTitle>
          <CardDescription>
            {t('admin.seo.hostHelp', "Domini públic on s'allotja la botiga (sense barra final).")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="host" className="sr-only">
            {t('admin.seo.host', 'URL base del lloc')}
          </Label>
          <Input
            id="host"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="https://..."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            {t('admin.seo.regenTitle', 'Regenerar sense desplegar')}
          </CardTitle>
          <CardDescription>
            {t(
              'admin.seo.regenDesc',
              'Genera ara mateix robots.txt i tots els sitemaps amb el contingut actual i els puja a Cloud Storage. Els fitxers de l’arrel del domini només es refresquen amb un desplegament; aquests s’actualitzen al moment.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => regenerate('all')}
              disabled={regenerating}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${regenBusy === 'all' ? 'animate-spin' : ''}`} />
              {regenBusy === 'all'
                ? t('admin.seo.regenerating', 'Regenerant…')
                : t('admin.seo.regenerateAll', 'Regenerar-ho tot')}
            </Button>
            <Button
              variant="outline"
              onClick={() => regenerate('sitemaps', { sitemapIndex: true, langs: 'all' })}
              disabled={regenerating}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${regenBusy === 'sitemaps' ? 'animate-spin' : ''}`} />
              {t('admin.seo.regenerateSitemaps', 'Només sitemaps (tots)')}
            </Button>
            <Button
              variant="outline"
              onClick={() => regenerate('sitemap-index', { sitemapIndex: true, langs: [] })}
              disabled={regenerating}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${regenBusy === 'sitemap-index' ? 'animate-spin' : ''}`} />
              {t('admin.seo.regenerateIndex', 'Només sitemap index')}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {languages.map((lng) => {
              const key = `sitemap-${lng.code}`;
              return (
                <Button
                  key={lng.code}
                  size="sm"
                  variant="outline"
                  disabled={regenerating}
                  onClick={() => regenerate(key, { langs: [lng.code] })}
                  className="gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${regenBusy === key ? 'animate-spin' : ''}`} />
                  {t('admin.seo.regenerateSitemapLang', 'Sitemap')} · {lng.code}
                </Button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            {t(
              'admin.seo.regenSelectiveHelp',
              'Pots regenerar només els sitemaps (global o per idioma) sense tocar el robots.txt.',
            )}
          </p>
          {live && (
            <div className="space-y-2 rounded-md border p-3 bg-muted/30">
              <p className="text-xs text-muted-foreground">
                {t('admin.seo.regenAt', 'Última regeneració:')}{' '}
                {new Date(live.generated_at).toLocaleString()}
              </p>
              <ul className="text-sm space-y-1">
                {(live.regenerated || []).map((p) => {
                  const name = p.split('/').pop() || p;
                  return (
                    <li key={p} className="flex items-center gap-2">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                      <span className="font-mono text-xs">{name}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapIcon className="h-5 w-5" />
            {t('admin.seo.sitemapsTitle', 'Sitemaps')}
          </CardTitle>
          <CardDescription>
            {t(
              'admin.seo.sitemapsDesc',
              'Puja el sitemap index a Google Search Console. Llistarà automàticament els sitemaps per idioma.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <UrlRow
            primary
            title={t('admin.seo.indexTitle', 'Sitemap index (recomanat)')}
            subtitle="/sitemap.xml"
            url={sitemapIndexUrl}
          />
          {languages.map((lng) => (
            <UrlRow
              key={lng.code}
              title={`${lng.native_name} (${lng.code})`}
              subtitle={`/sitemap-${lng.code}.xml`}
              url={sitemapLangUrl(lng.code)}
            />
          ))}
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
              'Es publica a l’arrel del domini i inclou la directiva Sitemap i el bloqueig de llistes privades, comptes, cistella, checkout, auth i admin.',
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UrlRow primary title="robots.txt" subtitle="/robots.txt" url={robotsUrl} />
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminMarketingSeo;
