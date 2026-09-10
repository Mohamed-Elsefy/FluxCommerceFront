/**
 * Sub-Phase 4.1 — Culture Model & Supported Cultures tests.
 *
 * Covers the centralized registry (codes, metadata, default), strict
 * validation with deterministic fallback, and direction resolution
 * (`ar` → `rtl`, all others → `ltr`).
 */

import { describe, expect, it } from 'vitest';
import {
  CULTURE_METADATA_BY_CODE,
  DEFAULT_CULTURE,
  SUPPORTED_CULTURE_METADATA,
  SUPPORTED_CULTURES,
  getCultureDirection,
  getCultureMetadata,
  isSupportedCulture,
  parseCulture,
  resolveCulture,
  resolveCultureDirection,
  resolveCultureMetadata,
} from './culture';

describe('supported culture registry', () => {
  it('defines exactly the five backend-supported cultures in stable order', () => {
    expect([...SUPPORTED_CULTURES]).toEqual(['en', 'fr', 'de', 'es', 'ar']);
  });

  it('uses en as the default culture fallback', () => {
    expect(DEFAULT_CULTURE).toBe('en');
    expect(SUPPORTED_CULTURES).toContain(DEFAULT_CULTURE);
  });

  it('provides metadata with code, display name, and direction for each culture', () => {
    expect(SUPPORTED_CULTURE_METADATA).toHaveLength(5);
    for (const metadata of SUPPORTED_CULTURE_METADATA) {
      expect(SUPPORTED_CULTURES).toContain(metadata.code);
      expect(metadata.displayName.trim().length).toBeGreaterThan(0);
      expect(['ltr', 'rtl']).toContain(metadata.direction);
    }
  });

  it('derives codes and lookups from the single registry without duplication', () => {
    expect(SUPPORTED_CULTURES.map((code) => CULTURE_METADATA_BY_CODE[code])).toEqual([
      ...SUPPORTED_CULTURE_METADATA,
    ]);
    expect(new Set(SUPPORTED_CULTURES).size).toBe(SUPPORTED_CULTURES.length);
  });
});

describe('culture validation', () => {
  it('accepts every supported culture exactly', () => {
    for (const culture of SUPPORTED_CULTURES) {
      expect(isSupportedCulture(culture)).toBe(true);
    }
  });

  it('rejects unsupported, empty, and non-string inputs deterministically', () => {
    for (const value of ['it', 'pt', '', 'EN', ' en ', null, undefined, 42, {}, []]) {
      expect(isSupportedCulture(value)).toBe(false);
    }
    expect(isSupportedCulture('it')).toBe(false);
    expect(isSupportedCulture('')).toBe(false);
    expect(isSupportedCulture(null)).toBe(false);
    expect(isSupportedCulture(undefined)).toBe(false);
    expect(isSupportedCulture(42)).toBe(false);
  });

  it('parses canonical codes strictly and normalizes case and whitespace', () => {
    expect(parseCulture('en')).toBe('en');
    expect(parseCulture('ar')).toBe('ar');
    expect(parseCulture('EN')).toBe('en');
    expect(parseCulture(' ar ')).toBe('ar');
  });

  it('returns null instead of raw strings for unsupported inputs', () => {
    expect(parseCulture('it')).toBeNull();
    expect(parseCulture('')).toBeNull();
    expect(parseCulture('   ')).toBeNull();
    expect(parseCulture(null)).toBeNull();
    expect(parseCulture(undefined)).toBeNull();
    expect(parseCulture(42)).toBeNull();
  });

  it('resolves any input to a supported culture with default fallback', () => {
    expect(resolveCulture('fr')).toBe('fr');
    expect(resolveCulture('DE')).toBe('de');
    expect(resolveCulture('it')).toBe(DEFAULT_CULTURE);
    expect(resolveCulture('')).toBe(DEFAULT_CULTURE);
    expect(resolveCulture(null)).toBe(DEFAULT_CULTURE);
    expect(resolveCulture(undefined)).toBe(DEFAULT_CULTURE);
  });
});

describe('culture metadata resolution', () => {
  it('returns registry metadata for each supported culture', () => {
    for (const code of SUPPORTED_CULTURES) {
      const metadata = getCultureMetadata(code);
      expect(metadata.code).toBe(code);
      expect(metadata).toBe(CULTURE_METADATA_BY_CODE[code]);
    }
  });

  it('resolves arbitrary inputs to metadata with default fallback', () => {
    expect(resolveCultureMetadata('de').code).toBe('de');
    expect(resolveCultureMetadata('ES').code).toBe('es');
    expect(resolveCultureMetadata('xx')).toBe(CULTURE_METADATA_BY_CODE[DEFAULT_CULTURE]);
    expect(resolveCultureMetadata(null)).toBe(CULTURE_METADATA_BY_CODE[DEFAULT_CULTURE]);
  });
});

describe('culture direction resolution', () => {
  it('resolves Arabic to rtl and all other supported cultures to ltr', () => {
    expect(getCultureDirection('ar')).toBe('rtl');
    for (const code of ['en', 'fr', 'de', 'es'] as const) {
      expect(getCultureDirection(code)).toBe('ltr');
    }
  });

  it('keeps registry metadata directions consistent with resolution', () => {
    for (const metadata of SUPPORTED_CULTURE_METADATA) {
      expect(getCultureDirection(metadata.code)).toBe(metadata.direction);
    }
  });

  it('resolves arbitrary inputs to a direction with default fallback', () => {
    expect(resolveCultureDirection('ar')).toBe('rtl');
    expect(resolveCultureDirection('en')).toBe('ltr');
    expect(resolveCultureDirection('xx')).toBe('ltr');
    expect(resolveCultureDirection(null)).toBe('ltr');
  });
});
