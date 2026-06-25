import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Cookie } from 'lucide-react';
import { useCookieConsent } from '@/contexts/CookieConsentContext';

const CookieBanner: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'ca';
  const { bannerVisible, settings, acceptAll, rejectAll, openPreferences } = useCookieConsent();

  if (!bannerVisible || !settings) return null;

  const text = (lang === 'es' ? settings.banner_text_es : settings.banner_text_ca)
    || t('cookies.banner.text', 'Utilitzem cookies pròpies i de tercers per millorar la teva experiència.');

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t('cookies.banner.title', 'Avís de cookies')}
      className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-4 pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-5xl bg-card border border-border shadow-xl rounded-lg p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Cookie className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-sm text-foreground/90 leading-relaxed">
              <p>{text}</p>
              <Link
                to={settings.policy_url || '/politica-cookies'}
                className="text-primary hover:underline text-xs mt-1 inline-block"
              >
                {t('cookies.banner.policyLink', 'Llegir la política de cookies')}
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2 md:flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => rejectAll()}>
              {t('cookies.banner.rejectAll', 'Rebutjar')}
            </Button>
            <Button variant="outline" size="sm" onClick={openPreferences}>
              {t('cookies.banner.configure', 'Configurar')}
            </Button>
            <Button size="sm" onClick={() => acceptAll()}>
              {t('cookies.banner.acceptAll', 'Acceptar')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
