/**
 * Centralized theme management for Sub-Phase 3.3 — Theme System.
 *
 * ```text
 * ThemeService
 *      ↓
 * data-theme (`<html data-theme="light|dark">`)
 *      ↓
 * CSS Variables (`tokens.css`: `:root` Light base, `:root[data-theme='dark']`
 * overrides — same names, so components never branch on theme)
 *      ↓
 * UI Components (consume variables only; never inject this service)
 * ```
 *
 * State is a single `Theme` signal (`theme`, readonly). Writes go through
 * `setTheme`/`toggleTheme`: signal update, root-attribute application, and
 * persistence stay atomic in one place, so switching is centralized.
 *
 * SSR/hydration safety: every browser-only access (`document`, `localStorage`)
 * is gated on `isPlatformBrowser`. On the server all reads return the default
 * and all writes are no-ops, so SSR renders the default shell and the browser
 * reconciles after hydration — no `ReferenceError`, no cross-user leakage
 * (preference is per-browser `localStorage`, never rendered into HTML).
 * Storage access is additionally `try/catch`-guarded (private-mode denials,
 * quota errors) and persisted values are validated with `isTheme`: startup
 * and switching never throw.
 *
 * Composition: applications register `provideTheming()` once at bootstrap
 * (alongside `provideApi()`/`provideSessionRestore()`); the `APP_INITIALIZER`
 * applies the startup theme without delaying bootstrap (synchronous, local).
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 3.4 — no UI primitives (Button, ThemeToggle, …).
 * - 3.5 — no layout primitives.
 * - 3.6+ — no shells or navigation.
 * - No OS `prefers-color-scheme` adoption (not in the approved 3.3 scope:
 *   default theme + explicit user persistence only).
 */

import {
  APP_INITIALIZER,
  EnvironmentProviders,
  inject,
  Injectable,
  makeEnvironmentProviders,
  PLATFORM_ID,
  signal,
  type Signal,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DEFAULT_THEME, isTheme, THEME_ATTRIBUTE, type Theme } from './theme';

/** `localStorage` key for the theme choice. A visual preference, not a secret. */
export const THEME_STORAGE_KEY = 'fluxcommerce.theme.v1';

/**
 * Sole owner of theme state. `providedIn: 'root'` (singleton per app);
 * startup application runs through `provideTheming()` → `initialize()`.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly current = signal<Theme>(this.readStored() ?? DEFAULT_THEME);

  /**
   * Current theme (readonly). For state observation only — styling must use
   * CSS variables, which already reflect this value via `data-theme`.
   */
  readonly theme: Signal<Theme> = this.current.asReadonly();

  /**
   * Applies the startup theme (persisted choice, else default) to the root
   * attribute. Idempotent and SSR-safe (server: no-op). Runs once at
   * bootstrap via `provideTheming()`; safe to call again.
   */
  initialize(): void {
    this.applyAttribute(this.current());
  }

  /** Switches to `theme`: updates state, root attribute, and persistence. */
  setTheme(theme: Theme): void {
    this.current.set(theme);
    this.applyAttribute(theme);
    this.store(theme);
  }

  /** Flips between Light and Dark (future `ThemeToggle` entry point). */
  toggleTheme(): void {
    this.setTheme(this.current() === 'dark' ? 'light' : 'dark');
  }

  /** Mirrors the theme onto `<html data-theme="…">`. No-op off-browser. */
  private applyAttribute(theme: Theme): void {
    if (!this.isBrowser) {
      return;
    }
    this.document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  }

  /** Reads the persisted choice; `null` when absent, invalid, or off-browser. Never throws. */
  private readStored(): Theme | null {
    if (!this.isBrowser) {
      return null;
    }
    try {
      const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
      return isTheme(raw) ? raw : null;
    } catch {
      return null;
    }
  }

  /** Persists the choice. No-op off-browser or when storage is unavailable. Never throws. */
  private store(theme: Theme): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage denied or full: the theme still applies for this session.
    }
  }
}

/**
 * Registration: applies the startup theme at bootstrap without delaying it
 * (synchronous, local — no I/O to await).
 */
export function provideTheming(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: (themes: ThemeService) => () => themes.initialize(),
      deps: [ThemeService],
    },
  ]);
}
