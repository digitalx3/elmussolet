import React from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, Link } from 'react-router-dom';
import {
  Package, LayoutDashboard, Tags, Bookmark, ListChecks,
  FileText, ShoppingCart, Users, Truck, Settings, ArrowLeft
} from 'lucide-react';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel,
  SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton,
  SidebarProvider, SidebarTrigger, useSidebar,
} from '@/components/ui/sidebar';
import { NavLink } from '@/components/NavLink';
import { Button } from '@/components/ui/button';

const navItems = [
  { key: 'dashboard', path: '/admin', icon: LayoutDashboard },
  { key: 'products', path: '/admin/productes', icon: Package },
  { key: 'categories', path: '/admin/categories', icon: Tags },
  { key: 'brands', path: '/admin/marques', icon: Bookmark },
  { key: 'orders', path: '/admin/comandes', icon: ShoppingCart },
  { key: 'lists', path: '/admin/llistes', icon: ListChecks },
  { key: 'templates', path: '/admin/plantilles', icon: FileText },
  { key: 'users', path: '/admin/usuaris', icon: Users },
  { key: 'shipping', path: '/admin/enviaments', icon: Truck },
  { key: 'settings', path: '/admin/configuracio', icon: Settings },
];

function AdminSidebar() {
  const { t } = useTranslation();
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r border-border">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && (
              <span className="font-display text-lg font-bold text-primary">Admin</span>
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(item => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.path}
                      end={item.path === '/admin'}
                      className="hover:bg-muted/50"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{t(`admin.${item.key}`)}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <SidebarProvider>
      <div className="min-h-[calc(100vh-8rem)] flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border px-4 gap-2">
            <SidebarTrigger />
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                <ArrowLeft className="h-4 w-4" />
                Botiga
              </Button>
            </Link>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default AdminLayout;
