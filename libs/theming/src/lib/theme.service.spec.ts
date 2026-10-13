/**
 * Theme system tests for Sub-Phase 3.3.
 *
 * Covers the startup path (default vs persisted choice, invalid entries),
 * centralized switching (signal + root attribute + persistence stay atomic),
 * the `provideTheming()` bootstrap initializer, and the server-platform path
 * (no DOM writes, no storage touches, no throw — SSR/hydration safety).
 */

import { PLATFORM_ID, type EnvironmentProviders, type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { THEME_ATTRIBUTE } from './theme';
import { THEME_STORAGE_KEY, ThemeService, provideTheming } from './theme.service';

function attribute(): string | null {
  return document.documentElement.getAttribute(THEME_ATTRIBUTE);
}

function configureModule(options: { platform?: string; initializer?: boolean } = {}): void {
  const providers: (Provider | EnvironmentProviders)[] = [];
  if (options.initializer === true) {
    providers.push(provideTheming());
  }
  if (options.platform !== undefined) {
    providers.push({ provide: PLATFORM_ID, useValue: options.platform });
  }
  TestBed.configureTestingModule({ providers });
}

function setup(options: { platform?: string; initializer?: boolean } = {}): ThemeService {
  configureModule(options);
  return TestBed.inject(ThemeService);
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute(THEME_ATTRIBUTE);
});

describe('ThemeService on the browser platform', () => {
  it('initializes with the dark default and applies the root attribute', () => {
    const service = setup();

    expect(service.theme()).toBe('dark');
    expect(attribute()).toBeNull();

    service.initialize();

    expect(service.theme()).toBe('dark');
    expect(attribute()).toBe('dark');
  });

  it('restores the persisted choice on initialize', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const service = setup();

    expect(service.theme()).toBe('light');

    service.initialize();

    expect(attribute()).toBe('light');
  });

  it('falls back to the dark default for invalid persisted values', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'midnight');
    const service = setup();

    service.initialize();

    expect(service.theme()).toBe('dark');
    expect(attribute()).toBe('dark');
  });

  it('setTheme updates state, root attribute, and persistence atomically', () => {
    const service = setup();
    service.initialize();

    service.setTheme('light');

    expect(service.theme()).toBe('light');
    expect(attribute()).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');

    service.setTheme('dark');

    expect(service.theme()).toBe('dark');
    expect(attribute()).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('toggleTheme flips between Dark and Light', () => {
    const service = setup();
    service.initialize();

    service.toggleTheme();

    expect(service.theme()).toBe('light');
    expect(attribute()).toBe('light');

    service.toggleTheme();

    expect(service.theme()).toBe('dark');
    expect(attribute()).toBe('dark');
  });

  it('applies the startup theme from the bootstrap initializer without manual initialize', () => {
    // Fresh module WITH the provider: TestBed executes app initializers on
    // instantiation, so the persisted choice must be seeded before injection.
    TestBed.resetTestingModule();
    configureModule({ initializer: true });
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');

    const service = TestBed.inject(ThemeService);

    expect(service.theme()).toBe('light');
    expect(attribute()).toBe('light');
  });
});

describe('ThemeService on the server platform (SSR)', () => {
  it('settles to the default without touching the DOM or storage', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light');
    const service = setup({ platform: 'server' });

    expect(service.theme()).toBe('dark');

    expect(() => service.initialize()).not.toThrow();
    expect(() => service.setTheme('dark')).not.toThrow();

    expect(service.theme()).toBe('dark');
    expect(attribute()).toBeNull();
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });
});
