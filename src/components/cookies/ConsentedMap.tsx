import React from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCookieConsent } from '@/contexts/CookieConsentContext';

interface Props {
  iframeHtml?: string;
  iframeUrl?: string;
}

const ConsentedMap: React.FC<Props> = ({ iframeHtml, iframeUrl }) => {
  const { t } = useTranslation();
  const { settings, hasConsent, openPreferences } = useCookieConsent();

  const requires = settings?.maps_requires_consent !== false;
  const granted = hasConsent('third_party');

  if (requires && !granted) {
    return (
      <div className="rounded-lg border border-border aspect-[4/3] bg-muted flex flex-col items-center justify-center text-center p-6 gap-3">
        <MapPin className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <div className="text-sm">
          <p className="font-medium">{t('cookies.map.blockedTitle', 'Mapa bloquejat')}</p>
          <p className="text-muted-foreground mt-1">
            {t('cookies.map.blockedDesc', 'Per veure el mapa cal acceptar les cookies de tercers.')}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={openPreferences}>
          {t('cookies.map.openSettings', 'Configurar cookies')}
        </Button>
      </div>
    );
  }

  if (iframeHtml) {
    return (
      <div
        className="rounded-lg overflow-hidden border border-border aspect-[4/3] bg-muted [&_iframe]:w-full [&_iframe]:h-full [&_iframe]:block [&_iframe]:border-0"
        dangerouslySetInnerHTML={{ __html: iframeHtml }}
      />
    );
  }
  if (iframeUrl) {
    return (
      <div className="rounded-lg overflow-hidden border border-border aspect-[4/3] bg-muted">
        <iframe
          src={iframeUrl}
          title="Map"
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    );
  }
  return null;
};

export default ConsentedMap;
