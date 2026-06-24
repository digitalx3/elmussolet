import { supabase } from '@/integrations/supabase/client';

export type AiLogStatus = 'success' | 'partial' | 'error';

export interface AiLogInput {
  function_name: string;
  scope?: string;
  source_language?: string | null;
  target_language?: string | null;
  items_count?: number;
  success_count?: number;
  error_count?: number;
  status: AiLogStatus;
  provider?: string | null;
  error_message?: string | null;
  duration_ms?: number;
  metadata?: Record<string, any>;
}

/**
 * Insert a row into ai_translation_logs.
 * Best-effort: never throws — logging failures should not block UX.
 */
export async function logAiTranslation(input: AiLogInput): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from('ai_translation_logs').insert({
      user_id: auth.user?.id ?? null,
      function_name: input.function_name,
      scope: input.scope ?? null,
      source_language: input.source_language ?? null,
      target_language: input.target_language ?? null,
      items_count: input.items_count ?? 0,
      success_count: input.success_count ?? 0,
      error_count: input.error_count ?? 0,
      status: input.status,
      provider: input.provider ?? null,
      error_message: input.error_message ?? null,
      duration_ms: input.duration_ms ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (e) {
    console.warn('logAiTranslation failed', e);
  }
}

export interface InvokeWithRetryOpts {
  retries?: number;            // default 2 (3 total attempts)
  backoffMs?: number;          // default 800
  onAttempt?: (attempt: number, err?: any) => void;
}

/**
 * Invoke a Supabase edge function with automatic retries on transient errors.
 * Retries on network errors, 429, 5xx. Does NOT retry on 4xx (other than 408/425/429).
 * Throws a detailed Error on final failure (message includes attempt count + last error).
 */
export async function invokeWithRetry<T = any>(
  fn: string,
  body: any,
  opts: InvokeWithRetryOpts = {}
): Promise<T> {
  const retries = opts.retries ?? 2;
  const backoff = opts.backoffMs ?? 800;
  let lastErr: any;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      opts.onAttempt?.(attempt);
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) throw error;
      // Some edge functions return { error } inside data even on 200.
      if (data && typeof data === 'object' && (data as any).error) {
        throw new Error(String((data as any).error));
      }
      return data as T;
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || e || '');
      const status = e?.context?.status ?? e?.status;
      const transient =
        msg === 'RATE_LIMIT' ||
        msg.includes('RATE_LIMIT') ||
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('timeout') ||
        (typeof status === 'number' && (status === 429 || status >= 500));
      if (!transient || attempt > retries) {
        opts.onAttempt?.(attempt, e);
        const detail = status ? ` (HTTP ${status})` : '';
        throw new Error(
          `${fn} ha fallat després de ${attempt} intent${attempt > 1 ? 's' : ''}${detail}: ${msg}`
        );
      }
      opts.onAttempt?.(attempt, e);
      await new Promise(r => setTimeout(r, backoff * attempt));
    }
  }
  throw lastErr;
}
