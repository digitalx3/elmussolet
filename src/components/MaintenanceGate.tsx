import React from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MaintenancePage from '@/pages/MaintenancePage';

interface MaintenanceState {
  enabled: boolean;
  bypass: boolean;
  show_logo: boolean;
  message_ca: string;
  message_es: string;
}

const CACHE_KEY = 'maintenance.state.v1';
const TOKEN_KEY = 'maintenance.emergency_token.v1';
const CACHE_TTL_MS = 60_000;

function readCache(): MaintenanceState | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.ts !== 'number' || Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.state as MaintenanceState;
  } catch {
    return null;
  }
}

function writeCache(state: MaintenanceState) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), state }));
  } catch {
    /* ignore */
  }
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

const MaintenanceGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin, isLoading } = useAuth();
  const { pathname } = useLocation();
  const [state, setState] = React.useState<MaintenanceState | null>(() => readCache());
  const [checked, setChecked] = React.useState<boolean>(() => readCache() !== null);

  // Capture emergency token from URL once (?mt_token=...) and persist it.
  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('mt_token');
      if (t) {
        writeStoredToken(t);
        try { sessionStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
        params.delete('mt_token');
        const newSearch = params.toString();
        const newUrl =
          window.location.pathname +
          (newSearch ? `?${newSearch}` : '') +
          window.location.hash;
        window.history.replaceState({}, '', newUrl);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const fetchState = React.useCallback(async () => {
    try {
      const token = readStoredToken();
      const { data, error } = await supabase.functions.invoke('check-maintenance-access', {
        headers: token ? { 'x-maintenance-token': token } : undefined,
      });
      if (error) throw error;
      const next: MaintenanceState = {
        enabled: !!data?.enabled,
        bypass: !!data?.bypass,
        show_logo: data?.show_logo ?? true,
        message_ca: data?.message_ca ?? '',
        message_es: data?.message_es ?? '',
      };
      setState(next);
      writeCache(next);
    } catch {
      const fallback: MaintenanceState = {
        enabled: false, bypass: true, show_logo: true, message_ca: '', message_es: '',
      };
      setState(fallback);
    } finally {
      setChecked(true);
    }
  }, []);

  React.useEffect(() => {
    fetchState();
    const onFocus = () => {
      if (!readCache()) fetchState();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [fetchState]);

  const isAdminArea =
    pathname.startsWith('/admin') ||
    pathname === '/login' ||
    pathname === '/recuperar-contrasenya' ||
    pathname === '/reset-password';

  if (!checked && !isAdminArea) {
    return <div className="min-h-screen" />;
  }

  if (state?.enabled && !state.bypass && !isAdminArea && !(isAdmin && !isLoading)) {
    return (
      <MaintenancePage
        showLogo={state.show_logo}
        messageCa={state.message_ca}
        messageEs={state.message_es}
      />
    );
  }

  return <>{children}</>;
};

export default MaintenanceGate;
