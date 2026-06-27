import { describe, it, expect } from 'vitest';
import i18next from 'i18next';
import { shippingSchema } from '@/pages/CheckoutPage';

// Ensure i18next returns the translated message used by the schema.
i18next.init({
  lng: 'ca',
  fallbackLng: 'ca',
  resources: {
    ca: {
      translation: {
        errors: {
          provinceRequired: 'La província és obligatòria per a Espanya.',
        },
      },
    },
  },
  interpolation: { escapeValue: false },
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
