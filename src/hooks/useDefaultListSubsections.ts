import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DefaultListSubsection {
  id: string;
  section_id: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
  translations: { language: string; name: string }[];
}

export function useDefaultListSubsections(options?: { onlyActive?: boolean; sectionId?: string | null }) {
  const onlyActive = options?.onlyActive ?? true;
  const sectionId = options?.sectionId ?? null;
  return useQuery({
    queryKey: ['default-list-subsections', { onlyActive, sectionId }],
    queryFn: async () => {
      let q = supabase
        .from('default_list_subsections')
        .select('id, section_id, slug, sort_order, is_active, default_list_subsection_translations(language, name)')
        .order('sort_order', { ascending: true });
      if (onlyActive) q = q.eq('is_active', true);
      if (sectionId) q = q.eq('section_id', sectionId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((s: any) => ({
        id: s.id,
        section_id: s.section_id,
        slug: s.slug,
        sort_order: s.sort_order,
        is_active: s.is_active,
        translations: s.default_list_subsection_translations ?? [],
      })) as DefaultListSubsection[];
    },
    staleTime: 60 * 1000,
  });
}

export function pickSubsectionName(
  sub: Pick<DefaultListSubsection, 'translations' | 'slug'>,
  lang: string,
  fallbackLang = 'ca',
): string {
  const t = sub.translations?.find(t => t.language === lang)?.name;
  if (t) return t;
  const f = sub.translations?.find(t => t.language === fallbackLang)?.name;
  if (f) return f;
  return sub.translations?.[0]?.name || sub.slug;
}
