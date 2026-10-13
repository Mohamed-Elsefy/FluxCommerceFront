/**
 * Formatting tests for Sub-Phase 4.6.
 *
 * Covers culture-aware date/number/currency output across all five
 * supported cultures (including Arabic locale behavior), deterministic
 * fallback for unknown cultures, and graceful handling of invalid values
 * and options (never throws, never crashes rendering).
 */

import { describe, expect, it } from 'vitest';
import type { Culture } from '../culture/culture';
import { formatCurrency, formatDate, formatNumber } from './formatting';

const ARABIC_DIGITS = /[٠-٩]/;

describe('formatNumber', () => {
  it('applies locale grouping and decimals per culture', () => {
    expect(formatNumber(1234567.89, 'en')).toBe('1,234,567.89');
    expect(formatNumber(1234567.89, 'de')).toBe('1.234.567,89');
    expect(formatNumber(1234567.89, 'es')).toBe('1.234.567,89');
    expect(formatNumber(1234567.89, 'fr')).not.toBe('1,234,567.89');
    expect(formatNumber(1234567.89, 'fr')).toContain(',');
  });

  it('uses Arabic-Indic digits for Arabic', () => {
    const formatted = formatNumber(1234567.89, 'ar');
    expect(formatted).toBe('١٬٢٣٤٬٥٦٧٫٨٩');
  });

  it('falls back to the default culture for unknown inputs', () => {
    expect(formatNumber(1234567.89, 'xx' as Culture)).toBe('1,234,567.89');
  });

  it('returns an empty string for non-finite values instead of throwing', () => {
    expect(formatNumber(Number.NaN, 'en')).toBe('');
    expect(formatNumber(Number.POSITIVE_INFINITY, 'de')).toBe('');
  });
});

describe('formatCurrency', () => {
  it('applies currency symbols and locale conventions per culture', () => {
    expect(formatCurrency(1234.5, 'USD', 'en')).toBe('$1,234.50');
    const german = formatCurrency(1234.5, 'USD', 'de');
    expect(german).toContain('1.234,50');
    expect(german).toContain('$');
    const french = formatCurrency(1234.5, 'EUR', 'fr');
    expect(french).toContain('€');
    expect(french).toContain(',');
  });

  it('localizes currency output for Arabic', () => {
    const formatted = formatCurrency(1234.5, 'USD', 'ar');
    expect(formatted).toMatch(ARABIC_DIGITS);
    expect(formatted).toContain('US$');
    expect(formatted).not.toBe('$1,234.50');
  });

  it('accepts lowercase currency codes and unknown cultures deterministically', () => {
    expect(formatCurrency(10, 'usd', 'en')).toBe('$10.00');
    expect(formatCurrency(10, 'USD', 'xx' as Culture)).toBe('$10.00');
  });

  it('returns an empty string for invalid amounts or currencies instead of throwing', () => {
    expect(formatCurrency(Number.NaN, 'USD', 'en')).toBe('');
    expect(formatCurrency(10, 'XX', 'en')).toBe('');
    expect(formatCurrency(10, '', 'en')).toBe('');
  });
});

describe('formatDate', () => {
  const noon = new Date(Date.UTC(2026, 0, 15, 12, 0, 0));
  const options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeZone: 'UTC' };

  it('renders locale date shapes per culture', () => {
    expect(formatDate(noon, 'en', options)).toBe('Jan 15, 2026');
    expect(formatDate(noon, 'de', options)).toBe('15.01.2026');
    for (const culture of ['fr', 'es'] as const) {
      const formatted = formatDate(noon, culture, options);
      expect(formatted).toContain('2026');
      expect(formatted).not.toBe('Jan 15, 2026');
    }
  });

  it('renders Arabic dates with Arabic-Indic digits', () => {
    const formatted = formatDate(noon, 'ar', options);
    expect(formatted).toMatch(ARABIC_DIGITS);
    expect(formatted).not.toBe('Jan 15, 2026');
  });

  it('accepts string and timestamp inputs and falls back for unknown cultures', () => {
    expect(formatDate('2026-01-15T12:00:00Z', 'en', options)).toBe('Jan 15, 2026');
    expect(formatDate(Date.UTC(2026, 0, 15, 12, 0, 0), 'en', options)).toBe('Jan 15, 2026');
    expect(formatDate(noon, 'xx' as Culture, options)).toBe('Jan 15, 2026');
  });

  it('returns an empty string for invalid values or options instead of throwing', () => {
    expect(formatDate('not-a-date', 'en', options)).toBe('');
    expect(formatDate(noon, 'en', { ...options, timeZone: 'Mars/Olympus' })).toBe('');
  });
});
