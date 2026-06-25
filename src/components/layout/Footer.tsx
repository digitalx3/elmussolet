import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Mail, Phone, MapPin, Instagram, Facebook, Youtube } from 'lucide-react';
import logoSquare from '@/assets/mussolet-logo-square.png.asset.json';
import { supabase } from '@/integrations/supabase/client';
import { useSiteSettings } from '@/hooks/useSiteSettings';
import { useCookieConsent } from '@/contexts/CookieConsentContext';

// Inline TikTok (lucide-react has no TikTok icon)
const TikTokIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M19.6 6.3a5.3 5.3 0 0 1-3.2-1.1 5.3 5.3 0 0 1-2-3.2h-3.1v13.5a2.5 2.5 0 1 1-1.8-2.4V9.9a5.6 5.6 0 1 0 4.9 5.6V9.2a8.3 8.3 0 0 0 5.2 1.8z" />
  </svg>
);

interface SocialDef { key: string; Icon: React.FC<{ className?: string }>; label: string }
const SOCIALS: SocialDef[] = [
  { key: 'social_instagram_url', Icon: Instagram as any, label: 'Instagram' },
  { key: 'social_facebook_url', Icon: Facebook as any, label: 'Facebook' },
  { key: 'social_tiktok_url', Icon: TikTokIcon, label: 'TikTok' },
  { key: 'social_youtube_url', Icon: Youtube as any, label: 'YouTube' },
];

const Footer: React.FC = () => {
  const { t, i18n } = useTranslation();
  const year = new Date().getFullYear();
  const lang = i18n.language === 'es' ? 'es' : 'ca';

  const { data: settings } = useSiteSettings([
    'logo_footer_url', 'store_name', 'store_email', 'store_phone', 'store_address',
    'footer_about_ca', 'footer_about_es',
    'footer_bottom_ca', 'footer_bottom_es',
    ...SOCIALS.map(s => s.key),
  ]);

  const { data: footerPages = [] } = useQuery({
    queryKey: ['cms-pages-menu', 'footer'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cms_blocks')
        .select('slug,title_ca,title_es,menu_order')
        .eq('kind', 'page')
        .eq('is_active', true)
        .eq('menu_location', 'footer')
        .order('menu_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });


  const logoUrl = settings?.logo_footer_url || logoSquare.url;
  const storeName = settings?.store_name || 'El Mussolet';
  const about = settings?.[`footer_about_${lang}`] || 'La teva botiga de puericultura online, roba de cotó orgànic i bambú.<br/>Llistes de naixement personalitzades.';
  const bottom = settings?.[`footer_bottom_${lang}`] || `© ${year} ${storeName}. ${t('footer.rights')}.`;

  return (
    <footer className="border-t border-border bg-card mt-auto">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <img src={logoUrl} alt={storeName} className="h-20 w-auto mb-3" />
            <div
              className="text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: about }}
            />
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              {settings?.store_email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  <a href={`mailto:${settings.store_email}`} className="hover:text-primary">{settings.store_email}</a>
                </div>
              )}
              {settings?.store_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  <a href={`tel:${settings.store_phone}`} className="hover:text-primary">{settings.store_phone}</a>
                </div>
              )}
              {settings?.store_address && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>{settings.store_address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Information / CMS pages */}
          <div>
            <h4 className="font-display text-sm font-semibold mb-3 text-foreground">{t('footer.info', 'Informació')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/contacte" className="text-muted-foreground hover:text-primary transition-colors">{t('footer.contact')}</Link></li>
              {footerPages.map((p: any) => (
                <li key={p.slug}>
                  <Link to={`/pagina/${p.slug}`} className="text-muted-foreground hover:text-primary transition-colors">
                    {(lang === 'es' ? p.title_es : p.title_ca) || p.slug}
                  </Link>
                </li>
              ))}
              <li><Link to="/politica-cookies" className="text-muted-foreground hover:text-primary transition-colors">{t('cookies.footer.policy', 'Política de cookies')}</Link></li>
              <li><CookiePrefsLink /></li>
            </ul>
          </div>


          {/* Catalog + Social */}
          <div>
            <h4 className="font-display text-sm font-semibold mb-3 text-foreground">{t('nav.catalog')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/cataleg" className="text-muted-foreground hover:text-primary transition-colors">{t('products.allProducts')}</Link></li>
              <li><Link to="/llista-naixement" className="text-muted-foreground hover:text-primary transition-colors">{t('nav.birthList')}</Link></li>
            </ul>

            {SOCIALS.some(s => settings?.[s.key]) && (
              <div className="mt-5">
                <h4 className="font-display text-sm font-semibold mb-3 text-foreground">{t('footer.followUs', 'Segueix-nos')}</h4>
                <div className="flex gap-3">
                  {SOCIALS.map(({ key, Icon, label }) => {
                    const url = settings?.[key];
                    if (!url) return null;
                    return (
                      <a
                        key={key}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={label}
                        className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-muted text-foreground/80 hover:bg-primary hover:text-primary-foreground transition-colors"
                      >
                        <Icon className="h-4 w-4" />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className="mt-10 pt-6 border-t border-border text-center text-xs text-muted-foreground prose prose-xs max-w-none [&_a]:text-primary"
          dangerouslySetInnerHTML={{ __html: bottom }}
        />
      </div>
    </footer>
  );
};

const CookiePrefsLink: React.FC = () => {
  const { t } = useTranslation();
  const { openPreferences } = useCookieConsent();
  return (
    <button
      type="button"
      onClick={openPreferences}
      className="text-muted-foreground hover:text-primary transition-colors text-left"
    >
      {t('cookies.footer.configure', 'Configurar cookies')}
    </button>
  );
};

export default Footer;
