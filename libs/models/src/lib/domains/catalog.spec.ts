import { describe, expect, it } from 'vitest';
import { VariantStatus } from '../common/enums';
import { isValidVariantPriceUpdate } from './catalog';

describe('variant update pre-check (Supplement S1: amount+currency paired)', () => {
  it('accepts sku/name-only and fully-paired updates', () => {
    expect(isValidVariantPriceUpdate({ sku: 'A-1' })).toBe(true);
    expect(isValidVariantPriceUpdate({ unitPriceAmount: 10, currency: 'USD' })).toBe(true);
    expect(isValidVariantPriceUpdate({ status: VariantStatus.Inactive })).toBe(true);
  });

  it('rejects unpaired, non-positive, or unknown-status updates', () => {
    expect(isValidVariantPriceUpdate({ unitPriceAmount: 10 })).toBe(false);
    expect(isValidVariantPriceUpdate({ currency: 'USD' })).toBe(false);
    expect(isValidVariantPriceUpdate({ unitPriceAmount: 0, currency: 'USD' })).toBe(false);
    expect(isValidVariantPriceUpdate({ status: 99 as VariantStatus })).toBe(false);
    expect(isValidVariantPriceUpdate(null)).toBe(false);
  });
});
