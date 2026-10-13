# ADR 009 — Localization Infrastructure

Status: Accepted (2026-09-10, Phase 4 Sub-Phases 4.1–4.3, 4.5–4.7).

## Context

Every future feature (Catalog, Cart, Orders, Payments, Admin) needs the
same capabilities — supported cultures, translation lookup, active-culture
state, backend propagation, formatting, localized messages — without each
feature inventing its own. The requirement (ARCHITECTURE.md §15) is one
central platform in `libs/i18n`, decoupled from features and safe for SSR.

## Decision

Pure data and functions first, one state owner, established seams only:

- Cultures, dictionaries, lookup/interpolation/fallback, formatting, and
  validation/error resolvers are pure TypeScript: explicit inputs, total
  functions (unknown → default/fallback, never throw), zero Angular/DOM/
  storage access — usable during server rendering by construction.
- Exactly one state owner exists: `CultureService` (signals, persisted →
  browser → default precedence, `provideCulture()` initializer). Nothing
  else stores culture.
- Backend propagation reuses the Phase 1 provider-seam pattern
  (`ACTIVE_CULTURE_PROVIDER`, mirroring `ACCESS_TOKEN_PROVIDER`):
  `requestConfigInterceptor` stays the single `Accept-Language` writer;
  explicit per-request context wins; `libs/api` never imports culture
  state and features never touch headers.

## Consequences

- Features consume culture, translations, formatting, and error messages
  without owning any of the machinery; business-specific content arrives
  with the feature that owns it.
- Unknown inputs (cultures, keys, codes) degrade deterministically to
  defaults instead of crashing rendering — asserted per sub-phase.
- Contributors add keys/resources/signal reads; they never add culture
  state, interceptors, or header logic — the audit and barrel boundaries
  hold the shape.
