import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, Phone, MapPin } from 'lucide-react';
import logoSquare from '@/assets/mussolet-logo-square.png.asset.json';

const Footer: React.FC = () => {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card mt-auto">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <img src={logoSquare.url} alt="El Mussolet" className="h-20 w-20 mb-3" />
            <p className="text-sm text-muted-foreground leading-relaxed">
              La teva botiga de puericultura de confiança al Berguedà.
            </p>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                <span>info@elmussolet.com</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span>Berga, Catalunya</span>
              </div>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-display text-sm font-semibold mb-3 text-foreground">{t('footer.contact')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/avis-legal" className="text-muted-foreground hover:text-primary transition-colors">{t('footer.legal')}</Link></li>
              <li><Link to="/privacitat" className="text-muted-foreground hover:text-primary transition-colors">{t('footer.privacy')}</Link></li>
              <li><Link to="/cookies" className="text-muted-foreground hover:text-primary transition-colors">{t('footer.cookies')}</Link></li>
              <li><Link to="/condicions" className="text-muted-foreground hover:text-primary transition-colors">{t('footer.terms')}</Link></li>
            </ul>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-display text-sm font-semibold mb-3 text-foreground">{t('nav.catalog')}</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/cataleg" className="text-muted-foreground hover:text-primary transition-colors">{t('products.allProducts')}</Link></li>
              <li><Link to="/llista-naixement" className="text-muted-foreground hover:text-primary transition-colors">{t('nav.birthList')}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          © {year} El Mussolet. {t('footer.rights')}.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
