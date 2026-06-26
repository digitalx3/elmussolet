import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import {
  Package, LayoutDashboard, Tags, Bookmark, ListChecks,
  FileText, ShoppingCart, Users, Truck, Settings, ArrowLeft, SlidersHorizontal, Image as ImageIcon,
  FileEdit, Home, Palette, Mail, Inbox, Server, ChevronDown, Database, Power, Languages as LanguagesIcon, Globe, Sparkles, PackageX, Star, Cookie, ShieldCheck,
} from 'lucide-react';
import AdminLanguageSwitcher from '@/components/admin/AdminLanguageSwitcher';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel,
  SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  SidebarProvider, SidebarTrigger, useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NavLink } from '@/components/NavLink';
import { Button } from '@/components/ui/button';

type NavItem = { key: string; path: string; icon: any; label?: string };
type NavGroup = { id: string; label: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    id: 'general',
    label: 'General',
    items: [
      { key: 'dashboard', path: '/admin', icon: LayoutDashboard },
    ],
  },
  {
    id: 'catalog',
    label: 'Catàleg',
    items: [
      { key: 'products', path: '/admin/productes', icon: Package },
      { key: 'featured', path: '/admin/productes-destacats', icon: Star, label: 'Productes destacats' },
      { key: 'attributes', path: '/admin/atributs', icon: SlidersHorizontal },
      { key: 'categories', path: '/admin/categories', icon: Tags },
      { key: 'brands', path: '/admin/marques', icon: Bookmark },
    ],
  },
  {
    id: 'orders',
    label: 'Comandes',
    items: [
      { key: 'orders', path: '/admin/comandes', icon: ShoppingCart },
      { key: 'lists', path: '/admin/llistes', icon: ListChecks },
      { key: 'templates', path: '/admin/plantilles', icon: FileText },
      { key: 'defaultSections', path: '/admin/families-defecte', icon: FileText },
    ],
  },
  {
    id: 'appearance',
    label: 'Aparença',
    items: [
      { key: 'appearance', path: '/admin/aparenca', icon: Palette },
      { key: 'heros', path: '/admin/heros', icon: ImageIcon },
      { key: 'homeContent', path: '/admin/home', icon: Home },
      { key: 'pages', path: '/admin/pagines', icon: FileEdit },
      { key: 'footerContact', path: '/admin/peu-contacte', icon: Mail },
    ],
  },
  {
    id: 'communication',
    label: 'Comunicació',
    items: [
      { key: 'messages', path: '/admin/missatges', icon: Inbox },
      { key: 'stockNotifications', path: '/admin/notificacions-stock', icon: PackageX, label: 'Avisos sense estoc' },
    ],
  },
  {
    id: 'config',
    label: 'Configuració',
    items: [
      { key: 'users', path: '/admin/usuaris', icon: Users },
      { key: 'shipping', path: '/admin/enviaments', icon: Truck },
      { key: 'languages', path: '/admin/idiomes', icon: LanguagesIcon },
      { key: 'translations', path: '/admin/traduccions', icon: Globe },
      { key: 'aiSettings', path: '/admin/ia', icon: Sparkles, label: "IA" },
      { key: 'aiHistory', path: '/admin/ia/historial', icon: Sparkles, label: "Historial IA" },
      { key: 'smtp', path: '/admin/smtp', icon: Server },
      { key: 'cookies', path: '/admin/cookies', icon: Cookie, label: 'Cookies' },
      { key: 'backups', path: '/admin/backups', icon: Database },
      { key: 'maintenance', path: '/admin/manteniment', icon: Power },
      { key: 'settings', path: '/admin/configuracio', icon: Settings },
    ],
  },
];

const SIDEBAR_STORAGE_KEY = 'admin.sidebar.open';
const GROUPS_STORAGE_KEY = 'admin.sidebar.groups';

const VALID_GROUP_IDS = new Set(groups.map(g => g.id));

function readStoredSidebarOpen(): boolean | null {
  try {
    const raw = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    if (raw !== null) localStorage.removeItem(SIDEBAR_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  return null;
}

function readStoredGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(GROUPS_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      localStorage.removeItem(GROUPS_STORAGE_KEY);
      return {};
    }
    const sanitized: Record<string, boolean> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (VALID_GROUP_IDS.has(key) && typeof value === 'boolean') {
        sanitized[key] = value;
      }
    }
    return sanitized;
  } catch {
    try {
      localStorage.removeItem(GROUPS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return {};
  }
}

function MenuLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { t } = useTranslation();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <NavLink
          to={item.path}
          end={item.path === '/admin'}
          className="hover:bg-muted/50"
          activeClassName="bg-primary/10 text-primary font-medium"
        >
          <item.icon className="mr-2 h-4 w-4" />
          {!collapsed && <span>{item.label ?? t(`admin.${item.key}`)}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function AdminSidebar() {
  const { state } = useSidebar();
  const { t } = useTranslation();
  const collapsed = state === 'collapsed';
  const { pathname } = useLocation();

  const isItemActive = (path: string) =>
    path === '/admin' ? pathname === '/admin' : pathname === path || pathname.startsWith(path + '/');

  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(() => {
    const saved = readStoredGroups();
    const initial: Record<string, boolean> = {};
    groups.forEach(g => {
      initial[g.id] = typeof saved[g.id] === 'boolean'
        ? saved[g.id]
        : g.items.some(i => isItemActive(i.path));
    });
    return initial;
  });

  React.useEffect(() => {
    try {
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(openGroups));
    } catch {
      /* ignore */
    }
  }, [openGroups]);

  React.useEffect(() => {
    setOpenGroups(prev => {
      const next = { ...prev };
      let changed = false;
      groups.forEach(g => {
        if (g.items.some(i => isItemActive(i.path)) && !next[g.id]) {
          next[g.id] = true;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);


  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && (
              <span className="font-display text-lg font-bold text-primary">Admin</span>
            )}
          </SidebarGroupLabel>
        </SidebarGroup>

        {collapsed
          ? groups.map((group, idx) => (
              <SidebarGroup key={group.id} className="py-1">
                {idx > 0 && (
                  <div className="mx-2 mb-1 h-px bg-border/60" aria-hidden="true" />
                )}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map(item => (
                      <MenuLink key={item.key} item={item} collapsed />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))
          : groups.map(group => {
              const isOpen = openGroups[group.id] ?? false;
              return (
                <Collapsible
                  key={group.id}
                  open={isOpen}
                  onOpenChange={(v) => setOpenGroups(s => ({ ...s, [group.id]: v }))}
                >
                  <SidebarGroup>
                    <CollapsibleTrigger asChild>
                      <SidebarGroupLabel className="cursor-pointer hover:bg-muted/50 rounded-md group/label">
                        <span className="flex-1 text-xs font-semibold uppercase tracking-wider">
                          {t(`admin.groups.${group.id}`, group.label)}
                        </span>
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                        />
                      </SidebarGroupLabel>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarGroupContent>
                        <SidebarMenu>
                          {group.items.map(item => (
                            <MenuLink key={item.key} item={item} collapsed={false} />
                          ))}
                        </SidebarMenu>
                      </SidebarGroupContent>
                    </CollapsibleContent>
                  </SidebarGroup>
                </Collapsible>
              );
            })}
      </SidebarContent>
    </Sidebar>
  );
}

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState<boolean>(() => {
    const stored = readStoredSidebarOpen();
    return stored ?? true;
  });

  const handleOpenChange = React.useCallback((value: boolean) => {
    setSidebarOpen(value);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(value));
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={handleOpenChange}>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border px-4 gap-2 bg-card sticky top-0 z-30">
            <SidebarTrigger />
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                <ArrowLeft className="h-4 w-4" />
                <BackToStoreLabel />
              </Button>
            </Link>
            <div className="ml-auto">
              <AdminLanguageSwitcher />
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};
function BackToStoreLabel() {
  const { t } = useTranslation();
  return <>{t('admin.backToStore', 'Botiga')}</>;
}

export default AdminLayout;
