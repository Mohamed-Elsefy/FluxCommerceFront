# ADR 011 — SSR Hydration Safety

Status: Accepted (2026-09-10, Phase 4 Sub-Phase 4.8).

## Context

Culture is per-browser state (`localStorage`, `navigator.language`) that
the server cannot observe. Naively rendering it server-side leaks one
user's locale into another's HTML and produces hydration mismatches
(Server-Arabic vs Client-English, Server-RTL vs Client-LTR).

## Decision

Server neutrality plus post-hydration reconciliation:

- On the server every culture read resolves to the default (`en`/`ltr`):
  no `localStorage`/`navigator`/DOM touches (platform-guarded, unit-proven
  on the server platform), so SSR always emits the same neutral shell —
  critically, the server never stamps `dir`, making a direction mismatch
  structurally impossible.
- The browser `provideCulture()` initializer reconciles immediately at
  bootstrap (synchronous, local): persisted → browser → default culture,
  root `dir`, and readiness gate — no layout shift afterward because
  translation resources are statically bundled, never fetched.
- Proof is behavioral, not conventional: the E2E suite renders SSR HTML
  with JavaScript disabled (heading present, no `dir`) and asserts the
  hydrated direction, the full switch/reload/persistence lifecycle, and
  `Accept-Language` propagation on both apps.

## Consequences

- SSR output is user-independent and hydration-stable by construction;
  regressions show up as E2E failures, not production flashes.
- Future locale-aware SSR (e.g. cookie-negotiated rendering) must preserve
  the invariant proven here: server HTML and client state agree on first
  paint, or the suite fails.
