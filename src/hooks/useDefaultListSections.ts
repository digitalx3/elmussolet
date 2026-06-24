import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DefaultListSection {
  id: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  translations: { language: string; name: string }[];
}

export function useDefaultListSections(options?: { onlyActive?: boolean }) {
  const onlyActive = options?.onlyActive ?? true;
  return useQuery({
    queryKey: ['default-list-sections', { onlyActive }],
    queryFn: async () => {
      let q = supabase
        .from('default_list_sections')
        .select('id, slug, sort_order, is_active, default_list_section_translations(language, name)')
        .order('sort_order', { ascending: true });
      if (onlyActive) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((s: any) => ({
        id: s.id,
        slug: s.slug,
        sort_order: s.sort_order,
        is_active: s.is_active,
        translations: s.default_list_section_translations ?? [],
      })) as DefaultListSection[];
    },
    staleTime: 60 * 1000,
  });
}

export function pickSectionName(
  section: Pick<DefaultListSection, 'translations' | 'slug'>,
  lang: string,
  fallbackLang = 'ca',
): string {
  const t = section.translations?.find(t => t.language === lang)?.name;
  if (t) return t;
  const f = section.translations?.find(t => t.language === fallbackLang)?.name;
  if (f) return f;
  return section.translations?.[0]?.name || section.slug;
}
