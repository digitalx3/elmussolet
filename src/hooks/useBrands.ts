import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';

import { slugify } from '@/lib/slug';

export interface Brand {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
}

export function useBrands() {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'ca').split('-')[0];

  return useQuery({
    queryKey: ['brands', lang],
    queryFn: async () => {
      const [{ data, error }, { data: trs, error: trErr }] = await Promise.all([
        supabase
          .from('brands')
          .select('*')
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('brand_translations')
          .select('brand_id, language_code, name, description')
          .eq('language_code', lang),
      ]);

      if (error) throw error;
      if (trErr) throw trErr;

      const trMap = new Map<string, { name: string | null; description: string | null }>();
      (trs || []).forEach((t: any) => trMap.set(t.brand_id, { name: t.name, description: t.description }));

      return (data || []).map((b: any): Brand => {
        const tr = trMap.get(b.id);
        return {
          id: b.id,
          name: (tr?.name && tr.name.trim()) || b.name,
          description: tr?.description ?? null,
          logoUrl: b.logo_url,
        };
      });
    },
  });
}
