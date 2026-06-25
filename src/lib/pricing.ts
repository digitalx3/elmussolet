// Centralised price computation: applies variant modifier + sale discount.
// All inputs are pre-tax; multiply by (1 + taxPct/100) at the call site if needed.

export type SalePriceType = 'fixed' | 'percent' | null;

export interface PriceInputs {
  basePrice: number;          // pre-tax base price
  salePriceType?: SalePriceType;
  saleValue?: number | null;  // either € (fixed) or % (percent)
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  variantPriceOverride?: number | null; // absolute pre-tax price (legacy)
  variantPriceModifier?: number | null; // signed delta on base_price
}

export interface PriceResult {
  base: number;        // pre-tax price WITHOUT sale (after variant adjustments)
  final: number;       // pre-tax price WITH sale applied
  onSale: boolean;
  discountPct: number; // 0..100, rounded
  savings: number;     // base - final
}

export function isSaleActive(
  type: SalePriceType | undefined,
  value: number | null | undefined,
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!type || value == null || Number(value) <= 0) return false;
  if (startsAt) {
    const s = new Date(startsAt);
    if (!isNaN(s.getTime()) && now < s) return false;
  }
  if (endsAt) {
    const e = new Date(endsAt);
    if (!isNaN(e.getTime()) && now > e) return false;
  }
  return true;
}

export function computePrice(input: PriceInputs, now: Date = new Date()): PriceResult {
  const baseRaw = Number(input.basePrice) || 0;

  // Variant adjustments — override wins; otherwise apply signed modifier.
  let base = baseRaw;
  if (input.variantPriceOverride != null) {
    base = Number(input.variantPriceOverride) || 0;
  } else if (input.variantPriceModifier) {
    base = baseRaw + Number(input.variantPriceModifier);
  }
  if (base < 0) base = 0;

  let final = base;
  const active = isSaleActive(input.salePriceType, input.saleValue, input.saleStartsAt, input.saleEndsAt, now);
  if (active && input.salePriceType && input.saleValue != null) {
    if (input.salePriceType === 'percent') {
      const pct = Math.max(0, Math.min(100, Number(input.saleValue)));
      final = base * (1 - pct / 100);
    } else if (input.salePriceType === 'fixed') {
      final = Math.max(0, Number(input.saleValue));
    }
  }

  const onSale = active && final < base;
  const savings = Math.max(0, base - final);
  const discountPct = base > 0 ? Math.round((savings / base) * 100) : 0;

  return { base, final, onSale, discountPct, savings };
}

export function formatPriceEUR(amount: number): string {
  return new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(amount);
}
