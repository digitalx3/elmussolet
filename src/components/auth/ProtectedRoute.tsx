import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

const Loading = () => (
  <div className="flex min-h-screen items-center justify-center text-muted-foreground">
    Carregant...
  </div>
);

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, isLoading } = useAuth();
  if (isLoading) return <Loading />;
  if (!user || !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isSuperAdmin, isLoading } = useAuth();
  const notified = React.useRef(false);
  React.useEffect(() => {
    if (!isLoading && user && !isSuperAdmin && !notified.current) {
      notified.current = true;
      toast({ title: 'Accés denegat', description: 'Aquesta secció és exclusiva del Super Admin.', variant: 'destructive' });
    }
  }, [isLoading, user, isSuperAdmin]);
  if (isLoading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (!isSuperAdmin) return <Navigate to="/admin" replace />;
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
  if (!user || !isAdmin) return <Navigate to="/" replace />;
  if (!allowed) return <Navigate to="/admin" replace />;
  return <>{children}</>;
};
