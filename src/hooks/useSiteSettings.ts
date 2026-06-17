import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Fetch a specific set of site_settings keys as a plain map.
 * Used by Header/Footer/Contact and other public surfaces.
 */
export function useSiteSettings(keys: string[]) {
  return useQuery({
    queryKey: ['site-settings-map', [...keys].sort().join(',')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', keys);
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach(r => { map[r.key] = r.value; });
      return map;
    },
    staleTime: 60_000,
  });
}
