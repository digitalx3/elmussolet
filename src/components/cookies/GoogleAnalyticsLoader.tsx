import { useEffect } from 'react';
import { useCookieConsent } from '@/contexts/CookieConsentContext';

const SCRIPT_ID = 'ga-gtag-loader';
const INLINE_ID = 'ga-gtag-inline';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    [key: `ga-disable-${string}`]: boolean | undefined;
  }
}

const GoogleAnalyticsLoader: React.FC = () => {
  const { settings, consent } = useCookieConsent();

  useEffect(() => {
    if (!settings) return;
    const measurementId = settings.ga_measurement_id?.trim();
    const enabled = settings.ga_enabled && !!measurementId;
    const granted = !!consent?.categories?.analytics;

    if (enabled && granted) {
      (window as any)[`ga-disable-${measurementId}`] = false;
      if (!document.getElementById(SCRIPT_ID)) {
        const s = document.createElement('script');
        s.id = SCRIPT_ID;
        s.async = true;
        s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
        document.head.appendChild(s);

        const inline = document.createElement('script');
        inline.id = INLINE_ID;
        inline.text = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${measurementId}',{anonymize_ip:true});`;
        document.head.appendChild(inline);
      }
    } else if (measurementId) {
      // Disable GA tracking if previously loaded
      (window as any)[`ga-disable-${measurementId}`] = true;
    }
  }, [settings, consent]);

  return null;
};

export default GoogleAnalyticsLoader;
