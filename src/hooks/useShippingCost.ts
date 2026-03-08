import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CartItem } from '@/contexts/CartContext';

interface ShippingZoneWithRates {
  id: string;
  name: string;
  postal_code_pattern: string;
  sort_order: number;
  rates: { min_weight_grams: number; max_weight_grams: number; price: number }[];
}

interface ShippingResult {
  cost: number | null;
  zoneName: string | null;
  loading: boolean;
  error: string | null;
  freeShippingThreshold: number;
  isFreeShipping: boolean;
}

/**
 * Matches a postal code against a zone pattern.
 * Pattern uses _ as single-char wildcard. Multiple patterns separated by commas.
 * e.g. "25___" matches 25000-25999, "08___,17___" matches 08xxx or 17xxx
 */
function matchesPostalCode(postalCode: string, pattern: string): boolean {
  const patterns = pattern.split(',').map(p => p.trim());
  return patterns.some(p => {
    if (p.length !== postalCode.length) return false;
    for (let i = 0; i < p.length; i++) {
      if (p[i] !== '_' && p[i] !== postalCode[i]) return false;
    }
    return true;
  });
}

export function useShippingCost(
  postalCode: string,
  items: CartItem[],
  deliveryMethod: 'pickup' | 'shipping',
  subtotal: number = 0
): ShippingResult {
  const [zones, setZones] = useState<ShippingZoneWithRates[]>([]);
  const [productWeights, setProductWeights] = useState<Record<string, number>>({});
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch zones + rates + free shipping threshold once
  useEffect(() => {
    const fetchData = async () => {
      const [zonesRes, ratesRes, settingRes] = await Promise.all([
        supabase.from('shipping_zones').select('id, name, postal_code_pattern, sort_order').eq('is_active', true).order('sort_order'),
        supabase.from('shipping_rates').select('zone_id, min_weight_grams, max_weight_grams, price'),
        supabase.from('site_settings').select('value').eq('key', 'free_shipping_threshold').single(),
      ]);

      if (zonesRes.data) {
        const mapped: ShippingZoneWithRates[] = zonesRes.data.map(z => ({
          ...z,
          sort_order: z.sort_order ?? 0,
          rates: (ratesRes.data ?? [])
            .filter(r => r.zone_id === z.id)
            .sort((a, b) => a.min_weight_grams - b.min_weight_grams),
        }));
        setZones(mapped);
      }

      if (settingRes.data?.value) {
        setFreeShippingThreshold(parseFloat(settingRes.data.value) || 0);
      }
    };
    fetchData();
  }, []);

  // Fetch product weights when items change
  useEffect(() => {
    if (items.length === 0) return;
    const ids = [...new Set(items.map(i => i.productId))];
    supabase
      .from('products')
      .select('id, weight_grams')
      .in('id', ids)
      .then(({ data }) => {
        const map: Record<string, number> = {};
        data?.forEach(p => { map[p.id] = p.weight_grams ?? 0; });
        setProductWeights(map);
      });
  }, [items.map(i => i.productId).join(',')]);

  const base = { freeShippingThreshold };
  const qualifiesFree = freeShippingThreshold > 0 && subtotal >= freeShippingThreshold;

  if (deliveryMethod === 'pickup') {
    return { ...base, cost: 0, zoneName: null, loading: false, error: null, isFreeShipping: false };
  }

  if (qualifiesFree) {
    return { ...base, cost: 0, zoneName: null, loading: false, error: null, isFreeShipping: true };
  }

  if (!postalCode || postalCode.length < 4 || zones.length === 0) {
    return { ...base, cost: null, zoneName: null, loading: false, error: null, isFreeShipping: false };
  }

  // Calculate total weight
  const totalWeight = items.reduce((sum, item) => {
    return sum + (productWeights[item.productId] ?? 500) * item.quantity;
  }, 0);

  // Find matching zone (sorted by sort_order, first match wins)
  const zone = zones.find(z => matchesPostalCode(postalCode, z.postal_code_pattern));
  if (!zone) {
    return { ...base, cost: null, zoneName: null, loading: false, error: 'no_zone', isFreeShipping: false };
  }

  // Find rate bracket
  const rate = zone.rates.find(r => totalWeight >= r.min_weight_grams && totalWeight <= r.max_weight_grams);
  if (!rate) {
    const highest = zone.rates[zone.rates.length - 1];
    return {
      ...base,
      cost: highest ? highest.price : null,
      zoneName: zone.name,
      loading: false,
      error: highest ? null : 'no_rate',
      isFreeShipping: false,
    };
  }

  return { ...base, cost: rate.price, zoneName: zone.name, loading: false, error: null, isFreeShipping: false };
}
