import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const Loading = () => (
  <div className="flex min-h-screen items-center justify-center text-muted-foreground">
    Carregant...
  </div>
);

const Forbidden: React.FC<{ message?: string }> = ({ message }) => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
    <div className="text-6xl font-bold text-destructive">403</div>
    <h1 className="font-display text-2xl font-semibold">Accés denegat</h1>
    <p className="max-w-md text-muted-foreground">
      {message ?? 'No tens permisos per accedir a aquesta secció.'}
    </p>
    <a href="/" className="text-primary hover:underline">Tornar a l'inici</a>
  </div>
);

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <Loading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
};

/**
 * AdminRoute — double guard:
 * 1) Client check via AuthContext (roles+profile) for instant UX.
 * 2) Server check via `is_admin` RPC (SECURITY DEFINER) so a tampered
 *    client cannot fake admin access. While the server check is pending,
 *    we render Loading. If the server denies, we render a 403 page.
 */
export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, isLoading } = useAuth();
  const location = useLocation();
  const [serverAdmin, setServerAdmin] = React.useState<boolean | null>(null);
  const notified = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    if (!user) { setServerAdmin(null); return; }
    setServerAdmin(null);
    supabase.rpc('is_admin', { _user_id: user.id }).then(({ data, error }) => {
      if (cancelled) return;
      setServerAdmin(!error && !!data);
    });
    return () => { cancelled = true; };
  }, [user?.id, location.pathname]);

  React.useEffect(() => {
    if (!isLoading && user && (!isAdmin || serverAdmin === false) && !notified.current) {
      notified.current = true;
      toast({ title: 'Accés denegat', description: 'Necessites permisos d\'administrador.', variant: 'destructive' });
    }
  }, [isLoading, user, isAdmin, serverAdmin]);

  if (isLoading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Forbidden />;
  if (serverAdmin === null) return <Loading />;
  if (!serverAdmin) return <Forbidden message="El servidor ha denegat l'accés a aquesta secció." />;
  return <>{children}</>;
};

export const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isSuperAdmin, isLoading } = useAuth();
  const [serverSuper, setServerSuper] = React.useState<boolean | null>(null);
  const notified = React.useRef(false);

  React.useEffect(() => {
    let cancelled = false;
    if (!user) { setServerSuper(null); return; }
    setServerSuper(null);
    supabase.rpc('is_super_admin', { _user_id: user.id }).then(({ data, error }) => {
      if (cancelled) return;
      setServerSuper(!error && !!data);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  React.useEffect(() => {
    if (!isLoading && user && (!isSuperAdmin || serverSuper === false) && !notified.current) {
      notified.current = true;
      toast({ title: 'Accés denegat', description: 'Aquesta secció és exclusiva del Super Admin.', variant: 'destructive' });
    }
  }, [isLoading, user, isSuperAdmin, serverSuper]);

  if (isLoading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isSuperAdmin) return <Forbidden message="Aquesta secció és exclusiva del Super Admin." />;
  if (serverSuper === null) return <Loading />;
  if (!serverSuper) return <Forbidden message="El servidor ha denegat l'accés Super Admin." />;
  return <>{children}</>;
};

export const PermissionRoute: React.FC<{ perm: string; children: React.ReactNode }> = ({ perm, children }) => {
  const { user, isAdmin, can, isLoading } = useAuth();
  const notified = React.useRef(false);
  const allowed = can(perm);
  React.useEffect(() => {
    if (!isLoading && user && isAdmin && !allowed && !notified.current) {
      notified.current = true;
      toast({ title: 'Accés denegat', description: 'No tens permís per accedir a aquesta secció.', variant: 'destructive' });
    }
  }, [isLoading, user, isAdmin, allowed]);
  if (isLoading) return <Loading />;
  if (!user || !isAdmin) return <Forbidden />;
  if (!allowed) return <Forbidden message="No tens permís per accedir a aquesta secció." />;
  return <>{children}</>;
};
