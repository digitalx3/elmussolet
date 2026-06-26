import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag, Menu, X, User, Globe, ChevronDown, Heart, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useListAccess } from '@/contexts/ListAccessContext';
import { Button } from '@/components/ui/button';
import logoHorizontal from '@/assets/mussolet-logo-horizontal.png.asset.json';
import { useSiteSettings } from '@/hooks/useSiteSettings';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Header: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { user, profile, isAdmin, signOut } = useAuth();
  const { totalItemsCount } = useCart();
  const { hasAccess, listCode, babyName, clearAccess } = useListAccess();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: settings } = useSiteSettings(['logo_header_url', 'store_name']);
  const logoUrl = settings?.logo_header_url || logoHorizontal.url;
  const storeName = settings?.store_name || 'El Mussolet';

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const lang = i18n.language === 'es' ? 'es' : 'ca';

  const { data: cmsPages = [] } = useQuery({
    queryKey: ['cms-pages-menu', 'header'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cms_blocks')
        .select('slug,title_ca,title_es,menu_order')
        .eq('kind', 'page')
        .eq('is_active', true)
        .eq('menu_location', 'header')
        .order('menu_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const navLinks = [
    { to: '/cataleg', label: t('nav.catalog') },
    { to: '/llista-naixement', label: t('nav.birthList') },
    ...cmsPages.map((p: any) => ({
      to: `/pagina/${p.slug}`,
      label: (lang === 'es' ? p.title_es : p.title_ca) || p.slug,
    })),
    ...(user ? [{ to: '/la-meva-llista', label: t('home.createList') }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <img src={logoUrl} alt={storeName} className="h-10 md:h-12 w-auto" />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map(link => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm font-medium text-foreground/80 transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Language */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                <Globe className="h-4 w-4" />
                <span className="text-xs uppercase">{i18n.language === 'es' ? 'ES' : 'CA'}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => changeLanguage('ca')}>Català</DropdownMenuItem>
              <DropdownMenuItem onClick={() => changeLanguage('es')}>Castellano</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline text-xs">{profile?.full_name || t('nav.myAccount')}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate('/el-meu-compte')}>
                  {t('nav.myAccount')}
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate('/admin')}>
                    {t('nav.admin')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => signOut()}>
                  {t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
              {t('nav.login')}
            </Button>
          )}

          {/* Cart */}
          <Button variant="ghost" size="sm" className="relative" onClick={() => navigate('/cistella')}>
            <ShoppingBag className="h-4 w-4" />
            {totalItemsCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                {totalItemsCount}
              </span>
            )}
          </Button>

          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-border bg-background p-4 animate-fade-in">
          <div className="flex flex-col gap-3">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className="text-sm font-medium text-foreground/80 hover:text-primary py-2"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
};

export default Header;
