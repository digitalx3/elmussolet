import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { setMediaConfig } from '@/lib/mediaUrl';

const KEYS = [
  'media_base_url',
  'assets_base_url',
  'site_canonical_url',
  'api_base_url',
  'storage_provider',
];

/**
 * Loads deployment-related site_settings once and caches them in mediaUrl helper.
 * Mount once at app root.
 */
const MediaConfigLoader: React.FC = () => {
  const { data } = useQuery({
    queryKey: ['media-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', KEYS);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!data) return;
    const cfg: Record<string, string> = {};
    data.forEach((row: any) => {
      cfg[row.key] = row.value;
    });
    setMediaConfig({
      media_base_url: cfg.media_base_url,
      assets_base_url: cfg.assets_base_url,
      site_canonical_url: cfg.site_canonical_url,
      api_base_url: cfg.api_base_url,
      storage_provider:
        cfg.storage_provider === 'vps' ? 'vps' : 'supabase',
    });
  }, [data]);

  return null;
};

export default MediaConfigLoader;
