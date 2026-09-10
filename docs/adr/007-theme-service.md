# ADR 007 — SSR-Safe Theme System

Status: Accepted (2026-09-10, Phase 3 Sub-Phases 3.3/3.10).

## Context

Light/Dark switching must be centralized (no per-component theme logic),
persist across reloads, and survive Storefront SSR without hydration
mismatches or cross-user leakage. Candidates were a service with Signals,
a SignalStore/NgRx slice, and attribute toggling from components.

## Decision

`ThemeService` (`libs/theming`, `providedIn: 'root'`) owns a single
`Theme` signal (readonly `theme` selector; `setTheme`/`toggleTheme`
writers that atomically update state, the `<html data-theme>` attribute,
and `localStorage`). Rationale:

- No store library: two states plus persistence are far below the
  complexity that justifies SignalStore/NgRx (ARCHITECTURE.md Rule 10).
- Every browser-only access (`document`, `localStorage`) is gated on
  `isPlatformBrowser` and `try/catch`-guarded; persisted values are
  validated with `isTheme`, defaulting safely. The server always renders
  the default shell; the browser reconciles post-hydration.
- Startup runs through `provideTheming()` → `provideAppInitializer`
  (`APP_INITIALIZER` is deprecated since Angular v19), synchronously and
  locally — bootstrap never waits.
- Shell chrome stays dumb: `ThemeToggle` (`libs/ui`) takes `mode` and
  emits `toggled`; shells wire `[mode]="themes.theme()"`
  `(toggled)="themes.toggleTheme()"`. `libs/ui` therefore never imports
  `@flux/theming` (Sub-Phase 3.1 boundary holds).

## Consequences

- Exactly one writer, one attribute, one storage key — theme bugs have one
  place to live.
- Components remain theme-agnostic; a third theme is a token block plus a
  union member, never a component change.
- No OS `prefers-color-scheme` adoption: outside the approved scope
  (explicit user choice + default only).
