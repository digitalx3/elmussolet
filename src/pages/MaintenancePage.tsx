import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { resolveMediaUrl } from '@/lib/mediaUrl';

interface Props {
  showLogo: boolean;
  messageCa: string;
  messageEs: string;
}

const MaintenancePage: React.FC<Props> = ({ showLogo, messageCa, messageEs }) => {
  const { i18n, t } = useTranslation();
  const { data: settings } = useSiteSettings(['logo_header_url', 'logo_footer_url', 'store_name']);
  const rawLogo = settings?.logo_header_url || settings?.logo_footer_url || '';
  const logoUrl = rawLogo ? resolveMediaUrl(rawLogo) : null;
  const siteName = settings?.store_name || 'El Mussolet';

  const lang = (i18n.language || 'ca').toLowerCase().startsWith('es') ? 'es' : 'ca';
  const message = lang === 'es' ? messageEs : messageCa;

  const fallback =
    lang === 'es'
      ? 'Estamos realizando tareas de mantenimiento. Volvemos enseguida.'
      : 'Estem realitzant tasques de manteniment. Tornem de seguida.';

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-12">
      <div className="max-w-xl w-full text-center space-y-8">
        {showLogo && logoUrl && (
          <img
            src={logoUrl}
            alt={siteName}
            className="mx-auto h-24 w-auto object-contain"
          />
        )}
        <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground">
          {lang === 'es' ? 'Estamos en mantenimiento' : 'Estem en manteniment'}
        </h1>
        {message ? (
          <div
            className="prose prose-sm md:prose-base mx-auto text-muted-foreground max-w-none"
            dangerouslySetInnerHTML={{ __html: message }}
          />
        ) : (
          <p className="text-muted-foreground">{fallback}</p>
        )}
      </div>
    </div>
  );
};

export default MaintenancePage;
