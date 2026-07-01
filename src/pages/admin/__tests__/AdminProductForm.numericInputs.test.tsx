import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

/**
 * These tests mirror the exact controlled-input logic used for numeric fields
 * in `src/pages/admin/AdminProductForm.tsx` (Preu sense IVA, Preu amb IVA, Pes).
 *
 * Regression: when the raw value was `parseFloat(e.target.value) || 0`, the
 * input immediately snapped back to "0" and could not be cleared. The fix
 * renders an empty string when the underlying number is 0 and only converts
 * non-empty strings to numbers.
 */

// ---------- Harness ----------

interface FormShape {
  base_price: number;
  weight_grams: number;
}

const priceWithTax = (net: number, taxPct: number) =>
  Math.round(net * (1 + taxPct / 100) * 100) / 100;

const Harness: React.FC<{ taxPct?: number; initial?: Partial<FormShape> }> = ({
  taxPct = 21,
  initial = {},
}) => {
  const [form, setForm] = useState<FormShape>({
    base_price: initial.base_price ?? 0,
    weight_grams: initial.weight_grams ?? 0,
  });
  const updateField = <K extends keyof FormShape>(k: K, v: FormShape[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const pvp = Math.round(priceWithTax(form.base_price, taxPct) * 100) / 100;

  return (
    <div>
      <label htmlFor="net">Preu sense IVA</label>
      <input
        id="net"
        type="number"
        step="0.01"
        min="0"
        value={form.base_price === 0 ? '' : form.base_price}
        onChange={(e) => {
          const v = e.target.value;
          updateField('base_price', v === '' ? 0 : parseFloat(v) || 0);
        }}
      />

      <label htmlFor="gross">Preu amb IVA</label>
      <input
        id="gross"
        type="number"
        step="0.01"
        min="0"
        value={form.base_price === 0 ? '' : pvp.toFixed(2)}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '') {
            updateField('base_price', 0);
            return;
          }
          const gross = Math.round((parseFloat(v) || 0) * 100) / 100;
          const net = taxPct > 0 ? gross / (1 + taxPct / 100) : gross;
          updateField('base_price', Math.round(net * 100) / 100);
        }}
      />

      <label htmlFor="weight">Pes</label>
      <input
        id="weight"
        type="number"
        min="0"
        value={form.weight_grams === 0 ? '' : form.weight_grams}
        onChange={(e) => {
          const v = e.target.value;
          updateField('weight_grams', v === '' ? 0 : parseInt(v) || 0);
        }}
      />

      <span data-testid="net-state">{form.base_price}</span>
      <span data-testid="weight-state">{form.weight_grams}</span>
    </div>
  );
};

// ---------- Tests ----------

describe('AdminProductForm numeric inputs', () => {
  it('starts empty when base_price is 0 (no stuck "0")', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Preu sense IVA')).toHaveValue(null);
    expect(screen.getByLabelText('Preu amb IVA')).toHaveValue(null);
    expect(screen.getByLabelText('Pes')).toHaveValue(null);
  });

  it('lets user type a net price', () => {
    render(<Harness />);
    const net = screen.getByLabelText('Preu sense IVA') as HTMLInputElement;
    fireEvent.change(net, { target: { value: '12.5' } });
    expect(net).toHaveValue(12.5);
    expect(screen.getByTestId('net-state').textContent).toBe('12.5');
  });

  it('lets user clear the net price without re-inserting a 0', () => {
    render(<Harness initial={{ base_price: 10 }} />);
    const net = screen.getByLabelText('Preu sense IVA') as HTMLInputElement;
    expect(net).toHaveValue(10);
    fireEvent.change(net, { target: { value: '' } });
    expect(net).toHaveValue(null);
    expect(screen.getByTestId('net-state').textContent).toBe('0');
  });

  it('keeps PVP in sync with net and taxPct', () => {
    render(<Harness initial={{ base_price: 100 }} taxPct={21} />);
    const gross = screen.getByLabelText('Preu amb IVA') as HTMLInputElement;
    expect(gross).toHaveValue(121);
  });

  it('lets user edit PVP directly and recomputes net', () => {
    render(<Harness taxPct={21} />);
    const gross = screen.getByLabelText('Preu amb IVA') as HTMLInputElement;
    fireEvent.change(gross, { target: { value: '121' } });
    expect(screen.getByTestId('net-state').textContent).toBe('100');
    expect(gross).toHaveValue(121);
  });

  it('lets user clear the PVP field completely', () => {
    render(<Harness initial={{ base_price: 100 }} taxPct={21} />);
    const gross = screen.getByLabelText('Preu amb IVA') as HTMLInputElement;
    fireEvent.change(gross, { target: { value: '' } });
    expect(gross).toHaveValue(null);
    expect(screen.getByLabelText('Preu sense IVA')).toHaveValue(null);
    expect(screen.getByTestId('net-state').textContent).toBe('0');
  });

  it('lets user clear the weight field', () => {
    render(<Harness initial={{ weight_grams: 500 }} />);
    const w = screen.getByLabelText('Pes') as HTMLInputElement;
    expect(w).toHaveValue(500);
    fireEvent.change(w, { target: { value: '' } });
    expect(w).toHaveValue(null);
    expect(screen.getByTestId('weight-state').textContent).toBe('0');
  });

  it('parses weight as integer (drops decimals)', () => {
    render(<Harness />);
    const w = screen.getByLabelText('Pes') as HTMLInputElement;
    fireEvent.change(w, { target: { value: '250' } });
    expect(screen.getByTestId('weight-state').textContent).toBe('250');
  });

  it('handles progressive typing without snapping back to 0', () => {
    render(<Harness />);
    const net = screen.getByLabelText('Preu sense IVA') as HTMLInputElement;
    fireEvent.change(net, { target: { value: '1' } });
    expect(net).toHaveValue(1);
    fireEvent.change(net, { target: { value: '12' } });
    expect(net).toHaveValue(12);
    fireEvent.change(net, { target: { value: '12.' } });
    // parseFloat('12.') === 12
    expect(screen.getByTestId('net-state').textContent).toBe('12');
    fireEvent.change(net, { target: { value: '12.9' } });
    expect(net).toHaveValue(12.9);
  });

  it('works with taxPct=0 (PVP equals net)', () => {
    render(<Harness taxPct={0} initial={{ base_price: 50 }} />);
    const gross = screen.getByLabelText('Preu amb IVA') as HTMLInputElement;
    expect(gross).toHaveValue(50);
    fireEvent.change(gross, { target: { value: '75' } });
    expect(screen.getByTestId('net-state').textContent).toBe('75');
  });
});
