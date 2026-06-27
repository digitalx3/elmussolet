import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Re-create the schema here to test the validation logic without UI coupling.
const shippingSchema = z.object({
  fullName: z.string().trim().min(1, 'Required').max(100),
  phone: z.string().trim().min(6, 'Required').max(20),
  addressLine1: z.string().trim().min(1, 'Required').max(200),
  addressLine2: z.string().max(200).optional().default(''),
  city: z.string().trim().min(1, 'Required').max(100),
  postalCode: z.string().trim().min(4, 'Required').max(10),
  province: z.string().trim().max(100).optional().default(''),
  country: z.string().trim().min(2, 'Required').max(2),
}).superRefine((data, ctx) => {
  if (data.country === 'ES' && !data.province.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'La província és obligatòria per a Espanya.',
      path: ['province'],
    });
  }
});

describe('shippingSchema province validation', () => {
  const validBase = {
    fullName: 'Anna Test',
    phone: '612345678',
    addressLine1: 'Carrer Major 1',
    addressLine2: '',
    city: 'Barcelona',
    postalCode: '08001',
    province: '',
    country: 'ES',
  };

  it('rejects empty province when country is ES', () => {
    const result = shippingSchema.safeParse(validBase);
    expect(result.success).toBe(false);
    const issues = result.success ? [] : result.error.issues;
    const provinceIssue = issues.find((i) => i.path.join('.') === 'province');
    expect(provinceIssue).toBeDefined();
    expect(provinceIssue?.message).toContain('província');
  });

  it('accepts empty province when country is not ES', () => {
    const result = shippingSchema.safeParse({ ...validBase, country: 'FR', province: '' });
    expect(result.success).toBe(true);
  });

  it('accepts a filled province when country is ES', () => {
    const result = shippingSchema.safeParse({ ...validBase, province: 'Barcelona' });
    expect(result.success).toBe(true);
  });
});
