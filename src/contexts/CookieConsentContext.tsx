import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  type ConsentState, type CookieCategoryKey,
  getConsent, onConsentChange, setConsent as setConsentLib,
  acceptAll as acceptAllLib, rejectAll as rejectAllLib,
  needsBanner, hasConsent as hasConsentLib,
} from '@/lib/cookieConsent';

interface CookieSettings {
  policy_version: number;
  ga_enabled: boolean;
  ga_measurement_id: string;
  maps_requires_consent: boolean;
  banner_text_ca: string;
  banner_text_es: string;
  banner_text_short_ca: string;
  banner_text_short_es: string;
  policy_url: string;
}

interface CookieCategory {
  id: string;
  key: CookieCategoryKey;
  is_required: boolean;
  is_enabled: boolean;
  sort_order: number;
  name_ca: string; name_es: string;
  description_ca: string; description_es: string;
}

interface CookieRegistryItem {
  id: string;
  name: string;
  provider: string;
  category_id: string;
  purpose_ca: string; purpose_es: string;
  duration: string;
  type: 'first_party' | 'third_party';
  requires_consent: boolean;
  service: string;
  sort_order: number;
}

interface CookieConsentContextValue {
  consent: ConsentState | null;
  settings: CookieSettings | null;
  categories: CookieCategory[];
  cookies: CookieRegistryItem[];
  loading: boolean;
  bannerVisible: boolean;
  preferencesOpen: boolean;
  openPreferences: () => void;
  closePreferences: () => void;
  acceptAll: () => Promise<void>;
  rejectAll: () => Promise<void>;
  savePreferences: (cats: Partial<Record<CookieCategoryKey, boolean>>) => Promise<void>;
  hasConsent: (k: CookieCategoryKey) => boolean;
}

const Ctx = createContext<CookieConsentContextValue | null>(null);

export const CookieConsentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [consent, setConsentState] = useState<ConsentState | null>(() => getConsent());
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  const { data: settings, isLoading: lSettings } = useQuery({
    queryKey: ['cookie-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cookie_settings' as any)
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as CookieSettings) ?? null;
    },
    staleTime: 60_000,
  });

  const { data: categories = [], isLoading: lCats } = useQuery({
    queryKey: ['cookie-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cookie_categories' as any)
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data as unknown as CookieCategory[]) ?? [];
    },
    staleTime: 60_000,
  });

  const { data: cookies = [], isLoading: lCookies } = useQuery({
    queryKey: ['cookies-registry'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cookies_registry' as any)
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data as unknown as CookieRegistryItem[]) ?? [];
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    const off = onConsentChange(setConsentState);
    return () => { off(); };
  }, []);

  const policyVersion = settings?.policy_version ?? 1;
  const bannerVisible = !!settings && needsBanner(policyVersion);

  const acceptAll = useCallback(async () => {
    await acceptAllLib(policyVersion);
  }, [policyVersion]);

  const rejectAll = useCallback(async () => {
    await rejectAllLib(policyVersion);
  }, [policyVersion]);

  const savePreferences = useCallback(async (cats: Partial<Record<CookieCategoryKey, boolean>>) => {
    await setConsentLib(cats, policyVersion, 'preferences');
  }, [policyVersion]);

  const openPreferences = useCallback(() => setPreferencesOpen(true), []);
  const closePreferences = useCallback(() => setPreferencesOpen(false), []);

  const value = useMemo<CookieConsentContextValue>(() => ({
    consent,
    settings: settings ?? null,
    categories,
    cookies,
    loading: lSettings || lCats || lCookies,
    bannerVisible,
    preferencesOpen,
    openPreferences,
    closePreferences,
    acceptAll,
    rejectAll,
    savePreferences,
    hasConsent: hasConsentLib,
  }), [consent, settings, categories, cookies, lSettings, lCats, lCookies, bannerVisible, preferencesOpen, openPreferences, closePreferences, acceptAll, rejectAll, savePreferences]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useCookieConsent(): CookieConsentContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCookieConsent must be used inside CookieConsentProvider');
  return ctx;
}
