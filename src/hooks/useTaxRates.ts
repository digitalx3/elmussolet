import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TaxRate {
  id: string;
  name: string;
  percentage: number;
  country_code: string;
  region: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export function useTaxRates() {
  return useQuery({
    queryKey: ['tax-rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_rates')
        .select('*')
        .order('country_code')
        .order('percentage', { ascending: false });
      if (error) throw error;
      return data as TaxRate[];
    },
  });
}

export function useActiveTaxRates() {
  return useQuery({
    queryKey: ['tax-rates-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_rates')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as TaxRate[];
    },
  });
}

export function useDefaultTaxRate() {
  return useQuery({
    queryKey: ['tax-rate-default'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_rates')
        .select('*')
        .eq('is_default', true)
        .eq('is_active', true)
        .single();
      if (error) return null;
      return data as TaxRate;
    },
  });
}

/** Calculate price with tax included */
export function priceWithTax(basePrice: number, taxPercentage: number): number {
  return basePrice * (1 + taxPercentage / 100);
}

/** Extract tax amount from a base price */
export function taxAmount(basePrice: number, taxPercentage: number): number {
  return basePrice * (taxPercentage / 100);
}

/** Format price for display */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(price);
}
