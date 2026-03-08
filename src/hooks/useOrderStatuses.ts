import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';

export interface OrderStatus {
  id: string;
  slug: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  name: string; // translated
}

export function useOrderStatuses() {
  const { i18n } = useTranslation();
  const lang = i18n.language;

  return useQuery({
    queryKey: ['order-statuses', lang],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_statuses')
        .select('*, order_status_translations(name, language)')
        .eq('is_active', true)
        .order('sort_order');

      if (error) throw error;

      return (data as any[]).map((s) => {
        const translations = s.order_status_translations || [];
        const tr = translations.find((t: any) => t.language === lang) || translations[0];
        return {
          id: s.id,
          slug: s.slug,
          color: s.color,
          sort_order: s.sort_order,
          is_active: s.is_active,
          name: tr?.name || s.slug,
        } as OrderStatus;
      });
    },
  });
}
