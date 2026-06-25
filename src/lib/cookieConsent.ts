import { supabase } from '@/integrations/supabase/client';

export type CookieCategoryKey = 'necessary' | 'functional' | 'analytics' | 'marketing' | 'third_party';

export interface ConsentState {
  version: number;
  categories: Record<CookieCategoryKey, boolean>;
  ts: string;
}

const LS_KEY = 'cookie_consent';
const ANON_KEY = 'cookie_anon_id';

const ALL_KEYS: CookieCategoryKey[] = ['necessary', 'functional', 'analytics', 'marketing', 'third_party'];

const listeners = new Set<(s: ConsentState | null) => void>();

function emit(state: ConsentState | null) {
  listeners.forEach(l => {
    try { l(state); } catch { /* noop */ }
  });
}

export function onConsentChange(cb: (s: ConsentState | null) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = (crypto as any)?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now();
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return 'anon';
  }
}

export function getConsent(): ConsentState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentState;
    if (!parsed || typeof parsed !== 'object' || !parsed.categories) return null;
    // Ensure necessary is always true
    parsed.categories.necessary = true;
    return parsed;
  } catch {
    return null;
  }
}

export function hasConsent(category: CookieCategoryKey): boolean {
  if (category === 'necessary') return true;
  const c = getConsent();
  return !!c?.categories?.[category];
}

const COOKIE_CLEANUP_MAP: Record<CookieCategoryKey, RegExp[]> = {
  necessary: [],
  functional: [],
  analytics: [/^_ga/, /^_gid$/, /^_gat/],
  marketing: [/^_fbp$/, /^fr$/],
  third_party: [],
};

function clearCookiesForCategory(cat: CookieCategoryKey) {
  if (typeof document === 'undefined') return;
  const patterns = COOKIE_CLEANUP_MAP[cat];
  if (!patterns.length) return;
  const cookies = document.cookie ? document.cookie.split(';') : [];
  const host = window.location.hostname;
  const hostParts = host.split('.');
  const domains = [host, '.' + host];
  if (hostParts.length > 1) domains.push('.' + hostParts.slice(-2).join('.'));
  cookies.forEach(c => {
    const name = c.split('=')[0].trim();
    if (patterns.some(p => p.test(name))) {
      domains.forEach(d => {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${d}`;
      });
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    }
  });
}

async function persistLog(state: ConsentState, source: string) {
  try {
    const userRes = await supabase.auth.getUser();
    const userId = userRes.data?.user?.id ?? null;
    await supabase.from('cookie_consent_log').insert({
      anon_id: getAnonId(),
      user_id: userId,
      consent: state.categories,
      policy_version: state.version,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : '',
      source,
    });
  } catch (err) {
    // Non-blocking: consent is still saved locally.
    console.warn('[cookieConsent] log persist failed', err);
  }
}

export async function setConsent(
  categories: Partial<Record<CookieCategoryKey, boolean>>,
  policyVersion: number,
  source: 'banner' | 'preferences' | 'accept_all' | 'reject_all' = 'preferences',
): Promise<ConsentState> {
  const prev = getConsent();
  const merged: Record<CookieCategoryKey, boolean> = {
    necessary: true,
    functional: false,
    analytics: false,
    marketing: false,
    third_party: false,
  };
  ALL_KEYS.forEach(k => {
    if (categories[k] !== undefined) merged[k] = !!categories[k];
    else if (prev && prev.categories[k] !== undefined) merged[k] = !!prev.categories[k];
  });
  merged.necessary = true;

  const state: ConsentState = {
    version: policyVersion,
    categories: merged,
    ts: new Date().toISOString(),
  };
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch { /* noop */ }

  // Best-effort cleanup for categories newly rejected
  if (prev) {
    ALL_KEYS.forEach(k => {
      if (prev.categories[k] && !merged[k]) clearCookiesForCategory(k);
    });
  }

  emit(state);
  await persistLog(state, source);
  return state;
}

export async function acceptAll(policyVersion: number): Promise<ConsentState> {
  const all: Record<CookieCategoryKey, boolean> = {
    necessary: true, functional: true, analytics: true, marketing: true, third_party: true,
  };
  return setConsent(all, policyVersion, 'accept_all');
}

export async function rejectAll(policyVersion: number): Promise<ConsentState> {
  const none: Record<CookieCategoryKey, boolean> = {
    necessary: true, functional: false, analytics: false, marketing: false, third_party: false,
  };
  return setConsent(none, policyVersion, 'reject_all');
}

export function needsBanner(policyVersion: number): boolean {
  const c = getConsent();
  if (!c) return true;
  return c.version !== policyVersion;
}

export function clearConsent() {
  try { localStorage.removeItem(LS_KEY); } catch { /* noop */ }
  ALL_KEYS.forEach(clearCookiesForCategory);
  emit(null);
}
