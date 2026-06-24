import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AiProvider = 'lovable' | 'openai' | 'anthropic';
export interface AiStatus {
  provider: AiProvider;
  available: { lovable: boolean; openai: boolean; anthropic: boolean };
}

export function useAiProvider() {
  return useQuery<AiStatus>({
    queryKey: ['ai-provider-status'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('ai-translate', {
        body: { action: 'status' },
      });
      if (error) throw error;
      return data as AiStatus;
    },
    staleTime: 30_000,
  });
}

/**
 * Returns whether the AI features (translate, SEO) are usable right now,
 * i.e. the selected provider has its API key set.
 */
export function isAiReady(s?: AiStatus): boolean {
  if (!s) return false;
  if (s.provider === 'openai') return !!s.available.openai;
  if (s.provider === 'anthropic') return !!s.available.anthropic;
  return !!s.available.lovable;
}
