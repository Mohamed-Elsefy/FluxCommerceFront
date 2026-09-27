import { describe, expect, it } from 'vitest';
import {
  normalizeSkuInput,
  reservationStatusDisplay,
  toAdjustStockRequest,
} from './inventory-admin.models';

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

describe('reservationStatusDisplay', () => {
  it('maps every known status to its bundle key and variant', () => {
    expect(reservationStatusDisplay(0)).toEqual({
      labelKey: 'inventory.reservationStatus.pending',
      variant: 'info',
    });
    expect(reservationStatusDisplay(1)).toEqual({
      labelKey: 'inventory.reservationStatus.committed',
      variant: 'success',
    });
    expect(reservationStatusDisplay(2)).toEqual({
      labelKey: 'inventory.reservationStatus.released',
      variant: 'neutral',
    });
    expect(reservationStatusDisplay(3)).toEqual({
      labelKey: 'inventory.reservationStatus.expired',
      variant: 'warning',
    });
  });

  it('falls back for unknown future values instead of crashing', () => {
    expect(reservationStatusDisplay(99)).toEqual({
      labelKey: 'inventory.reservationStatus.unknown',
      variant: 'neutral',
    });
  });
});

describe('toAdjustStockRequest', () => {
  it('projects editor text into the additive body without range rules', () => {
    expect(toAdjustStockRequest(' 25 ')).toEqual({ quantity: 25 });
    expect(toAdjustStockRequest(null)).toEqual({ quantity: 0 });
  });
});
