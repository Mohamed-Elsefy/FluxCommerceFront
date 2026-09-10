/**
 * Sub-Phase 4.2 — Translation Resource System tests.
 *
 * Covers resource loading, nested key lookup, interpolation, missing-key
 * behavior, and deterministic fallback (target → `'en'` → key path).
 */

import { describe, expect, it } from 'vitest';
import { DEFAULT_CULTURE, SUPPORTED_CULTURES, type Culture } from '../culture/culture';
import {
  AR_TRANSLATIONS,
  DE_TRANSLATIONS,
  EN_TRANSLATIONS,
  ES_TRANSLATIONS,
  FR_TRANSLATIONS,
  TRANSLATION_RESOURCES,
  bundledCultures,
} from './translation-dictionaries';
import type { TranslationDictionary, TranslationResources } from './translation-model';
import {
  hasTranslation,
  interpolateTranslation,
  loadTranslationDictionary,
  lookupTranslationKey,
  translate,
  translateKey,
} from './translations';

/** Flattens a nested dictionary to its dot-separated leaf key paths. */
function leafKeys(dictionary: TranslationDictionary, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [segment, value] of Object.entries(dictionary)) {
    const path = prefix === '' ? segment : `${prefix}.${segment}`;
    if (typeof value === 'string') {
      keys.push(path);
    } else {
      keys.push(...leafKeys(value, path));
    }
  }
  return keys.sort();
}

const PARTIAL_RESOURCES: TranslationResources = {
  en: {
    common: { actions: { save: 'Save', cancel: 'Cancel' } },
    errors: { network: 'Network error ({code}).' },
  },
  fr: {
    common: { actions: { save: 'Enregistrer' } },
    errors: {},
  },
  de: { common: { actions: { save: 'Speichern' } } },
  es: { common: { actions: { save: 'Guardar' } } },
  ar: { common: { actions: { save: 'حفظ' } } },
};

describe('translation resource loading', () => {
  it('loads the bundled dictionary for each supported culture', () => {
    expect(loadTranslationDictionary('en')).toBe(EN_TRANSLATIONS);
    expect(loadTranslationDictionary('fr')).toBe(FR_TRANSLATIONS);
    expect(loadTranslationDictionary('de')).toBe(DE_TRANSLATIONS);
    expect(loadTranslationDictionary('es')).toBe(ES_TRANSLATIONS);
    expect(loadTranslationDictionary('ar')).toBe(AR_TRANSLATIONS);
  });

  it('falls back to the default dictionary for unknown culture inputs', () => {
    const fallback = TRANSLATION_RESOURCES[DEFAULT_CULTURE];
    for (const value of ['xx', '', null, undefined] as const) {
      expect(loadTranslationDictionary(value as Culture)).toBe(fallback);
    }
  });

  it('bundles resources for exactly the five supported cultures', () => {
    expect(bundledCultures(TRANSLATION_RESOURCES).sort()).toEqual([...SUPPORTED_CULTURES].sort());
  });
});

describe('base translation dictionaries', () => {
  it('exposes the same key set in every supported culture', () => {
    const reference = leafKeys(EN_TRANSLATIONS);
    expect(reference.length).toBeGreaterThan(0);
    for (const dictionary of [FR_TRANSLATIONS, DE_TRANSLATIONS, ES_TRANSLATIONS, AR_TRANSLATIONS]) {
      expect(leafKeys(dictionary)).toEqual(reference);
    }
  });

  it('covers the documented key convention examples', () => {
    for (const key of [
      'common.actions.save',
      'common.actions.cancel',
      'common.validation.required',
      'errors.unauthorized',
      'errors.network',
    ]) {
      for (const culture of SUPPORTED_CULTURES) {
        const value = lookupTranslationKey(TRANSLATION_RESOURCES[culture], key);
        expect(typeof value === 'string' && value.length > 0).toBe(true);
      }
    }
  });

  it('provides localized action labels per culture', () => {
    expect(translateKey('en', 'common.actions.save')).toBe('Save');
    expect(translateKey('fr', 'common.actions.save')).toBe('Enregistrer');
    expect(translateKey('de', 'common.actions.save')).toBe('Speichern');
    expect(translateKey('es', 'common.actions.save')).toBe('Guardar');
    expect(translateKey('ar', 'common.actions.save')).toBe('حفظ');
  });
});

describe('lookupTranslationKey', () => {
  it('resolves nested keys at any depth', () => {
    expect(lookupTranslationKey(EN_TRANSLATIONS, 'common.actions.save')).toBe('Save');
    expect(lookupTranslationKey(EN_TRANSLATIONS, 'errors.network')).toContain('network');
  });

  it('returns undefined for missing, empty, or interior-node paths', () => {
    expect(lookupTranslationKey(EN_TRANSLATIONS, 'common.actions.delete')).toBeUndefined();
    expect(lookupTranslationKey(EN_TRANSLATIONS, 'common.missing.deep.key')).toBeUndefined();
    expect(lookupTranslationKey(EN_TRANSLATIONS, 'common.actions')).toBeUndefined();
    expect(lookupTranslationKey(EN_TRANSLATIONS, '')).toBeUndefined();
    expect(lookupTranslationKey(EN_TRANSLATIONS, 'common.actions.save.deeper')).toBeUndefined();
  });
});

describe('interpolateTranslation', () => {
  it('substitutes single and multiple placeholders', () => {
    expect(interpolateTranslation('Hello {name}.', { name: 'Ada' })).toBe('Hello Ada.');
    expect(interpolateTranslation('{greeting}, {name}!', { greeting: 'Hi', name: 'Ada' })).toBe(
      'Hi, Ada!',
    );
  });

  it('stringifies number and boolean params', () => {
    expect(interpolateTranslation('Enter at least {min} characters.', { min: 8 })).toBe(
      'Enter at least 8 characters.',
    );
    expect(interpolateTranslation('Enabled: {flag}.', { flag: false })).toBe('Enabled: false.');
  });

  it('preserves slots without a matching param and ignores extra params', () => {
    expect(interpolateTranslation('Hello {name}.', {})).toBe('Hello {name}.');
    expect(interpolateTranslation('Hello.', { name: 'Ada' })).toBe('Hello.');
    expect(interpolateTranslation('{a} and {b}.', { a: 'x' })).toBe('x and {b}.');
  });
});

describe('hasTranslation', () => {
  it('detects present and absent keys without fallback', () => {
    expect(hasTranslation(PARTIAL_RESOURCES, 'fr', 'common.actions.save')).toBe(true);
    expect(hasTranslation(PARTIAL_RESOURCES, 'fr', 'common.actions.cancel')).toBe(false);
    expect(hasTranslation(PARTIAL_RESOURCES, 'de', 'errors.network')).toBe(false);
  });
});

describe('translate fallback and missing-key behavior', () => {
  it('resolves keys from the target culture dictionary', () => {
    expect(translate(PARTIAL_RESOURCES, 'fr', 'common.actions.save')).toBe('Enregistrer');
  });

  it('falls back deterministically to the default culture dictionary', () => {
    expect(translate(PARTIAL_RESOURCES, 'fr', 'common.actions.cancel')).toBe('Cancel');
    expect(translate(PARTIAL_RESOURCES, 'de', 'errors.network', { code: 500 })).toBe(
      'Network error (500).',
    );
  });

  it('returns the key path gracefully when missing everywhere', () => {
    expect(translate(PARTIAL_RESOURCES, 'ar', 'common.actions.delete')).toBe(
      'common.actions.delete',
    );
    expect(translate(PARTIAL_RESOURCES, 'en', 'missing.key')).toBe('missing.key');
    expect(translate(PARTIAL_RESOURCES, 'fr', 'common.actions')).toBe('common.actions');
  });

  it('resolves unknown culture inputs through the default culture', () => {
    expect(translate(PARTIAL_RESOURCES, 'xx' as Culture, 'common.actions.save')).toBe('Save');
  });

  it('interpolates bundled parameterized resources end to end', () => {
    expect(translateKey('en', 'common.validation.minLength', { min: 8 })).toBe(
      'Enter at least 8 characters.',
    );
    expect(translateKey('ar', 'common.validation.minLength', { min: 8 })).toBe(
      'أدخل 8 أحرف على الأقل.',
    );
    expect(translateKey('de', 'errors.network')).toContain('Netzwerkfehler');
  });
});
