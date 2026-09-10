/**
 * Sub-Phase 4.3 — Culture State & Language Switching.
 *
 * Centralized culture management for the application:
 *
 * ```text
 * Persisted Culture (localStorage)
 *      ↓ (absent or invalid)
 * Browser Preference (navigator.language primary subtag, browser only)
 *      ↓ (absent or unsupported)
 * Application Default ('en')
 *      ↓
 * CultureService.culture (readonly signal)
 *      ↓ (Sub-Phase 4.4: direction resolution via the 4.1 mapping)
 * CultureService.direction (readonly computed: 'ar' → 'rtl', else 'ltr')
 *      ↓
 * Phase 3 direction mechanism (`<html dir="ltr|rtl">` + logical-property
 * CSS from ADR 008 — consumed, never reimplemented)
 *      ↓
 * setCulture(...) — culture, persistence, and root direction update
 * atomically at runtime without a page reload
 * ```
 *
 * State is a single `Culture` signal (`culture`, readonly). Direction is a
 * `computed` derived from it — never stored separately, so there is no
 * duplicate direction state. Writes go through `setCulture` and startup
 * goes through `initialize`: signal update, persistence, and root-`dir`
 * application stay atomic in one place, so switching is centralized and
 * synchronous — language and direction changes apply without a full
 * browser page reload.
 *
 * Phase 3 integration: the service is the single writer of the root `dir`
 * attribute (mirroring how `ThemeService` owns `data-theme`). All layout
 * response flows through the existing logical-property stylesheets and
 * shells untouched — no component changes, no direction branching, no
 * per-direction variants (all still audit-enforced).
 *
 * SSR/hydration safety: every browser-only access (`window.navigator`,
 * `localStorage`) is gated on `isPlatformBrowser`. On the server all reads
 * return the default and persistence is a no-op, so SSR renders the default
 * shell and the browser reconciles after hydration — no `ReferenceError`,
 * no cross-user leakage (preference is per-browser `localStorage`, never
 * rendered into HTML). Storage access is additionally `try/catch`-guarded
 * (private-mode denials, quota errors) and every input is validated through
 * the Sub-Phase 4.1 utilities: startup and switching never throw.
 *
 * Composition: applications register `provideCulture()` once at bootstrap
 * (alongside `provideTheming()`/`provideSessionRestore()`); the app
 * initializer applies the startup culture without delaying bootstrap
 * (synchronous, local).
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 4.5 — no HTTP/request-context propagation of the culture.
 */

import {
  EnvironmentProviders,
  computed,
  inject,
  Injectable,
  PLATFORM_ID,
  provideAppInitializer,
  signal,
  type Signal,
} from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  DEFAULT_CULTURE,
  SUPPORTED_CULTURES,
  getCultureDirection,
  parseCulture,
  resolveCulture,
  type Culture,
  type CultureDirection,
} from './culture';

/** `localStorage` key for the culture choice. A locale preference, not a secret. */
export const CULTURE_STORAGE_KEY = 'fluxcommerce.culture.v1';

/** Root attribute carrying the active layout direction (e.g. `<html dir="rtl">`). */
export const DIR_ATTRIBUTE = 'dir';

/**
 * Extracts the supported culture from a browser language tag by matching its
 * primary subtag (e.g. `'fr-FR'` → `'fr'`, `'ar-EG'` → `'ar'`). Returns
 * `null` for anything unsupported. Never throws.
 */
export function cultureFromBrowserLanguage(language: unknown): Culture | null {
  if (typeof language !== 'string') {
    return null;
  }
  const primary = language.split(/[-_]/)[0]?.trim().toLowerCase() ?? '';
  return parseCulture(primary);
}

/**
 * Resolves the startup culture following the strict precedence: persisted
 * choice → browser preference → application default. Pure and deterministic;
 * never throws.
 */
export function resolveInitialCulture(persisted: unknown, browserLanguage: unknown): Culture {
  return parseCulture(persisted) ?? cultureFromBrowserLanguage(browserLanguage) ?? DEFAULT_CULTURE;
}

/**
 * Sole owner of culture state. `providedIn: 'root'` (singleton per app);
 * startup application runs through `provideCulture()` → `initialize()`.
 */
@Injectable({ providedIn: 'root' })
export class CultureService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly current = signal<Culture>(this.resolveInitial());
  private readonly ready = signal(false);

  /** Active culture (readonly). Switch via {@link setCulture}. */
  readonly culture: Signal<Culture> = this.current.asReadonly();

  /**
   * Active layout direction (readonly computed: `'rtl'` for Arabic, `'ltr'`
   * otherwise). Derived from {@link culture} — never stored separately, so
   * there is no duplicate direction state.
   */
  readonly direction: Signal<CultureDirection> = computed(() =>
    getCultureDirection(this.current()),
  );

  /** Supported cultures (readonly). Static registry exposed reactively. */
  readonly supportedCultures: Signal<readonly Culture[]> = signal(SUPPORTED_CULTURES).asReadonly();

  /**
   * Readiness gate (readonly). False until {@link initialize} runs — the
   * single signal consumers await before treating the culture as settled.
   */
  readonly initialized: Signal<boolean> = this.ready.asReadonly();

  /**
   * Applies the startup culture (persisted → browser → default precedence)
   * and mirrors its direction onto the root element. Idempotent and
   * SSR-safe (server: settles to the default, no DOM writes). Runs once at
   * bootstrap via `provideCulture()`; safe to call again.
   */
  initialize(): void {
    const resolved = this.resolveInitial();
    this.current.set(resolved);
    this.applyDirection(resolved);
    this.ready.set(true);
  }

  /**
   * Switches to `culture` at runtime: updates state, persistence, and root
   * direction synchronously without a page reload. Runtime-invalid inputs
   * resolve deterministically to the default culture. Never throws.
   */
  setCulture(culture: Culture): void {
    const resolved = resolveCulture(culture);
    this.current.set(resolved);
    this.applyDirection(resolved);
    this.store(resolved);
  }

  /**
   * Mirrors the culture direction onto `<html dir="…">` — the single writer
   * of the Phase 3 direction mechanism. No-op off-browser. Never throws.
   */
  private applyDirection(culture: Culture): void {
    if (!this.isBrowser) {
      return;
    }
    this.document.documentElement.setAttribute(DIR_ATTRIBUTE, getCultureDirection(culture));
  }

  /** Resolves the startup culture from storage and browser preference. Never throws. */
  private resolveInitial(): Culture {
    return resolveInitialCulture(this.readStored(), this.readBrowserLanguage());
  }

  /** Reads the persisted choice; `null` when absent, invalid, or off-browser. Never throws. */
  private readStored(): string | null {
    if (!this.isBrowser) {
      return null;
    }
    try {
      return window.localStorage.getItem(CULTURE_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  /** Reads the browser language tag; `null` when unavailable or off-browser. Never throws. */
  private readBrowserLanguage(): string | null {
    if (!this.isBrowser) {
      return null;
    }
    try {
      const language = window.navigator?.language ?? null;
      return typeof language === 'string' ? language : null;
    } catch {
      return null;
    }
  }

  /** Persists the choice. No-op off-browser or when storage is unavailable. Never throws. */
  private store(culture: Culture): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      window.localStorage.setItem(CULTURE_STORAGE_KEY, culture);
    } catch {
      // Storage denied or full: the culture still applies for this session.
    }
  }
}

/**
 * Registration: applies the startup culture at bootstrap without delaying it
 * (synchronous, local — no I/O to await). Uses `provideAppInitializer`
 * (`APP_INITIALIZER` has been deprecated since Angular v19).
 */
export function provideCulture(): EnvironmentProviders {
  return provideAppInitializer(() => inject(CultureService).initialize());
}
