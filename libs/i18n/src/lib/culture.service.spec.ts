/**
 * Culture state tests for Sub-Phases 4.3–4.4.
 *
 * Covers the precedence path (persisted vs browser preference vs default),
 * centralized runtime switching (signal + persistence stay atomic, no page
 * reload), the `provideCulture()` bootstrap initializer, the Sub-Phase 4.4
 * culture-to-direction integration (derived `direction` signal plus root
 * `dir` application through the Phase 3 mechanism), and the server-platform
 * path (default settlement, no DOM writes, no storage touches, no throw —
 * SSR/hydration safety).
 */

import { PLATFORM_ID, type EnvironmentProviders, type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_CULTURE, SUPPORTED_CULTURES, type Culture } from './culture';
import {
  CULTURE_STORAGE_KEY,
  DIR_ATTRIBUTE,
  CultureService,
  cultureFromBrowserLanguage,
  provideCulture,
  resolveInitialCulture,
} from './culture.service';

function stubBrowserLanguage(value: string): void {
  Object.defineProperty(window.navigator, 'language', { value, configurable: true });
}

function configureModule(options: { platform?: string; initializer?: boolean } = {}): void {
  const providers: (Provider | EnvironmentProviders)[] = [];
  if (options.initializer === true) {
    providers.push(provideCulture());
  }
  if (options.platform !== undefined) {
    providers.push({ provide: PLATFORM_ID, useValue: options.platform });
  }
  TestBed.configureTestingModule({ providers });
}

function setup(options: { platform?: string; initializer?: boolean } = {}): CultureService {
  configureModule(options);
  return TestBed.inject(CultureService);
}

function stored(): string | null {
  return window.localStorage.getItem(CULTURE_STORAGE_KEY);
}

function rootDirection(): string | null {
  return document.documentElement.getAttribute(DIR_ATTRIBUTE);
}

beforeEach(() => {
  window.localStorage.clear();
  stubBrowserLanguage('en-US');
  document.documentElement.removeAttribute(DIR_ATTRIBUTE);
});

describe('culture initialization precedence', () => {
  it('prefers the persisted culture over the browser preference', () => {
    expect(resolveInitialCulture('ar', 'fr-FR')).toBe('ar');
  });

  it('falls back to the browser language primary subtag when nothing is persisted', () => {
    expect(resolveInitialCulture(null, 'fr-FR')).toBe('fr');
    expect(resolveInitialCulture('xx', 'de')).toBe('de');
    expect(resolveInitialCulture(undefined, 'es-MX')).toBe('es');
  });

  it('falls back to the default culture when nothing resolves', () => {
    expect(resolveInitialCulture(null, null)).toBe(DEFAULT_CULTURE);
    expect(resolveInitialCulture('xx', 'pt-BR')).toBe(DEFAULT_CULTURE);
    expect(resolveInitialCulture(null, 42)).toBe(DEFAULT_CULTURE);
  });
});

describe('cultureFromBrowserLanguage', () => {
  it('matches primary subtags case-insensitively across separators', () => {
    expect(cultureFromBrowserLanguage('fr')).toBe('fr');
    expect(cultureFromBrowserLanguage('fr-FR')).toBe('fr');
    expect(cultureFromBrowserLanguage('ar-EG')).toBe('ar');
    expect(cultureFromBrowserLanguage('EN_us')).toBe('en');
  });

  it('returns null for unsupported or non-string inputs', () => {
    expect(cultureFromBrowserLanguage('pt-BR')).toBeNull();
    expect(cultureFromBrowserLanguage('')).toBeNull();
    expect(cultureFromBrowserLanguage(null)).toBeNull();
    expect(cultureFromBrowserLanguage(undefined)).toBeNull();
    expect(cultureFromBrowserLanguage(42)).toBeNull();
  });
});

describe('CultureService on the browser platform', () => {
  it('starts uninitialized at the default culture', () => {
    stubBrowserLanguage('xx');
    const service = setup();

    expect(service.culture()).toBe(DEFAULT_CULTURE);
    expect(service.initialized()).toBe(false);
    expect([...service.supportedCultures()]).toEqual([...SUPPORTED_CULTURES]);
  });

  it('initializes from the persisted culture ahead of the browser preference', () => {
    window.localStorage.setItem(CULTURE_STORAGE_KEY, 'ar');
    stubBrowserLanguage('fr');
    const service = setup();

    expect(service.culture()).toBe('ar');

    service.initialize();

    expect(service.culture()).toBe('ar');
    expect(service.initialized()).toBe(true);
  });

  it('initializes from the browser preference when nothing is persisted', () => {
    stubBrowserLanguage('es-MX');
    const service = setup();

    service.initialize();

    expect(service.culture()).toBe('es');
    expect(service.initialized()).toBe(true);
  });

  it('falls back to the default culture for invalid persisted values', () => {
    window.localStorage.setItem(CULTURE_STORAGE_KEY, 'midnight');
    stubBrowserLanguage('xx');
    const service = setup();

    service.initialize();

    expect(service.culture()).toBe(DEFAULT_CULTURE);
    expect(service.initialized()).toBe(true);
  });

  it('setCulture switches state and persistence atomically without a page reload', () => {
    const href = window.location.href;
    const service = setup();
    service.initialize();

    service.setCulture('ar');

    expect(service.culture()).toBe('ar');
    expect(stored()).toBe('ar');
    expect(window.location.href).toBe(href);

    service.setCulture('fr');

    expect(service.culture()).toBe('fr');
    expect(stored()).toBe('fr');
    expect(window.location.href).toBe(href);
  });

  it('setCulture resolves runtime-invalid inputs to the default culture', () => {
    const service = setup();
    service.initialize();

    service.setCulture('xx' as Culture);

    expect(service.culture()).toBe(DEFAULT_CULTURE);
    expect(stored()).toBe(DEFAULT_CULTURE);
  });

  it('applies the startup culture from the bootstrap initializer without manual initialize', () => {
    // Fresh module WITH the provider: TestBed executes app initializers on
    // instantiation, so the persisted choice must be seeded before injection.
    TestBed.resetTestingModule();
    configureModule({ initializer: true });
    window.localStorage.setItem(CULTURE_STORAGE_KEY, 'de');

    const service = TestBed.inject(CultureService);

    expect(service.culture()).toBe('de');
    expect(service.initialized()).toBe(true);
  });
});

describe('culture-to-direction integration (Sub-Phase 4.4)', () => {
  it('derives rtl for Arabic and ltr for every other supported culture', () => {
    const service = setup();
    service.initialize();

    expect(service.direction()).toBe('ltr');

    for (const culture of ['en', 'fr', 'de', 'es'] as const) {
      service.setCulture(culture);
      expect(service.direction()).toBe('ltr');
    }

    service.setCulture('ar');
    expect(service.direction()).toBe('rtl');
  });

  it('applies the startup direction to the root element on initialize', () => {
    window.localStorage.setItem(CULTURE_STORAGE_KEY, 'ar');
    stubBrowserLanguage('en');
    const service = setup();

    expect(rootDirection()).toBeNull();

    service.initialize();

    expect(service.culture()).toBe('ar');
    expect(service.direction()).toBe('rtl');
    expect(rootDirection()).toBe('rtl');
  });

  it('flips the root direction at runtime without a page reload', () => {
    const href = window.location.href;
    const service = setup();
    service.initialize();

    expect(rootDirection()).toBe('ltr');

    service.setCulture('ar');

    expect(service.direction()).toBe('rtl');
    expect(rootDirection()).toBe('rtl');
    expect(window.location.href).toBe(href);

    service.setCulture('en');

    expect(service.direction()).toBe('ltr');
    expect(rootDirection()).toBe('ltr');
    expect(window.location.href).toBe(href);
  });

  it('applies the startup direction from the bootstrap initializer', () => {
    TestBed.resetTestingModule();
    configureModule({ initializer: true });
    window.localStorage.setItem(CULTURE_STORAGE_KEY, 'ar');

    const service = TestBed.inject(CultureService);

    expect(service.direction()).toBe('rtl');
    expect(rootDirection()).toBe('rtl');
  });
});

describe('CultureService on the server platform (SSR)', () => {
  it('settles to the default without touching storage', () => {
    window.localStorage.setItem(CULTURE_STORAGE_KEY, 'fr');
    stubBrowserLanguage('de');
    const service = setup({ platform: 'server' });

    expect(service.culture()).toBe(DEFAULT_CULTURE);
    expect(service.initialized()).toBe(false);

    expect(() => service.initialize()).not.toThrow();

    expect(service.culture()).toBe(DEFAULT_CULTURE);
    expect(service.initialized()).toBe(true);
    expect(rootDirection()).toBeNull();
    expect(stored()).toBe('fr');
  });

  it('setCulture updates in-memory state only and never throws', () => {
    window.localStorage.setItem(CULTURE_STORAGE_KEY, 'fr');
    const service = setup({ platform: 'server' });

    expect(() => service.setCulture('ar')).not.toThrow();

    expect(service.culture()).toBe('ar');
    expect(service.direction()).toBe('rtl');
    expect(rootDirection()).toBeNull();
    expect(stored()).toBe('fr');
  });
});
