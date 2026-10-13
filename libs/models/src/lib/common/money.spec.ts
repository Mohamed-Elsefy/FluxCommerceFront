import { describe, expect, it } from 'vitest';
import { hasSameCurrency, isMoney, isValidCurrencyCode, moneyCurrencyOf } from './money';

describe('shared money model (Refactoring Phase A)', () => {
  it('validates ISO-4217 currency codes (UPPER, exactly 3 letters)', () => {
    expect(isValidCurrencyCode('USD')).toBe(true);
    expect(isValidCurrencyCode('EUR')).toBe(true);
    expect(isValidCurrencyCode('usd')).toBe(false);
    expect(isValidCurrencyCode('US')).toBe(false);
    expect(isValidCurrencyCode('USDD')).toBe(false);
    expect(isValidCurrencyCode('')).toBe(false);
    expect(isValidCurrencyCode(null)).toBe(false);
    expect(isValidCurrencyCode(undefined)).toBe(false);
    expect(isValidCurrencyCode(840)).toBe(false);
  });

  it('narrows structural money values (finite amount + string currency)', () => {
    expect(isMoney({ amount: 29.99, currency: 'USD' })).toBe(true);
    expect(isMoney({ amount: 0, currency: '' })).toBe(true);
    expect(isMoney({ amount: NaN, currency: 'USD' })).toBe(false);
    expect(isMoney({ amount: '29.99', currency: 'USD' })).toBe(false);
    expect(isMoney({ amount: 29.99 })).toBe(false);
    expect(isMoney(null)).toBe(false);
    expect(isMoney(undefined)).toBe(false);
  });

  it('reads currency verbatim or null when absent', () => {
    expect(moneyCurrencyOf({ amount: 1, currency: 'USD' })).toBe('USD');
    expect(moneyCurrencyOf({ amount: 1, currency: '' })).toBeNull();
    expect(moneyCurrencyOf(null)).toBeNull();
    expect(moneyCurrencyOf(undefined)).toBeNull();
  });

  it('detects currency agreement without converting', () => {
    const usd = { amount: 1, currency: 'USD' };
    expect(hasSameCurrency(usd, { amount: 2, currency: 'USD' })).toBe(true);
    expect(hasSameCurrency(usd, { amount: 1, currency: 'EUR' })).toBe(false);
    expect(hasSameCurrency(null, null)).toBe(true);
    expect(hasSameCurrency(usd, null)).toBe(false);
  });
});
