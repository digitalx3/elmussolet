import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregant...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin, isLoading } = useAuth();
  if (isLoading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregant...</div>;
  if (!user || !isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};
