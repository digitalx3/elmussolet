import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';

export interface TranslatedCategory {
  id: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  name: string;
  description: string | null;
}

export function useCategories() {
  const { i18n } = useTranslation();
  const lang = i18n.language === 'es' ? 'es' : 'ca';

  return useQuery({
    queryKey: ['categories', lang],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*, category_translations!inner(name, description, language)')
        .eq('is_active', true)
        .eq('category_translations.language', lang)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      return (data || []).map((c: any): TranslatedCategory => {
        const t = Array.isArray(c.category_translations) ? c.category_translations[0] : c.category_translations;
        return {
          id: c.id,
          slug: c.slug,
          parentId: c.parent_id,
          sortOrder: c.sort_order ?? 0,
          name: t?.name ?? c.slug,
          description: t?.description ?? null,
        };
      });
    },
  });
}
