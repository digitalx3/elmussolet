import React from 'react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, ExternalLink, FileText, Map as MapIcon } from 'lucide-react';
import { useLanguages } from '@/hooks/useLanguages';
import { notify } from '@/lib/notify';

const DEFAULT_HOST =
  typeof window !== 'undefined' ? window.location.origin : 'https://elmussolet.lovable.app';

const AdminMarketingSeo: React.FC = () => {
  const { t } = useTranslation();
  const { data: languages = [] } = useLanguages({ onlyEnabled: true });
  const [host, setHost] = React.useState<string>(DEFAULT_HOST);

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

  const UrlRow: React.FC<{ title: string; subtitle?: string; url: string; primary?: boolean }> = ({
    title,
    subtitle,
    url,
    primary,
  }) => (
    <div
      className={`rounded-md p-3 space-y-2 ${
        primary ? 'border-2 border-primary/40 bg-primary/5' : 'border'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="font-medium text-sm">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
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
