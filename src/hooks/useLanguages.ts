import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Language {
  code: string;
  name: string;
  native_name: string;
  is_enabled: boolean;
  is_default: boolean;
  sort_order: number;
}

export function useLanguages(options?: { onlyEnabled?: boolean }) {
  const onlyEnabled = options?.onlyEnabled ?? true;
  return useQuery({
    queryKey: ['languages', { onlyEnabled }],
    queryFn: async () => {
      let q = supabase.from('languages').select('*').order('sort_order', { ascending: true });
      if (onlyEnabled) q = q.eq('is_enabled', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Language[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDefaultLanguage() {
  return useQuery({
    queryKey: ['languages', 'default'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('languages')
        .select('*')
        .eq('is_default', true)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as Language | null;
    },
    staleTime: 5 * 60 * 1000,
  });
}
