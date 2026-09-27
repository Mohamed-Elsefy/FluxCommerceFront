import { describe, expect, it } from 'vitest';
import { normalizeSkuInput } from './inventory-admin.models';

describe('normalizeSkuInput', () => {
  it('trims and uppercases editor text for deterministic transport', () => {
    expect(normalizeSkuInput('  tee-blk-m ')).toBe('TEE-BLK-M');
    expect(normalizeSkuInput('TEE-BLK-M')).toBe('TEE-BLK-M');
  });

  it('coerces missing input to the empty string (the form blocks the call)', () => {
    expect(normalizeSkuInput(null)).toBe('');
    expect(normalizeSkuInput(undefined)).toBe('');
    expect(normalizeSkuInput('   ')).toBe('');
  });
});
