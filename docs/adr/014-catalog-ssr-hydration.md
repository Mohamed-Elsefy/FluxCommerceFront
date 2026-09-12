# ADR 014 — Catalog SSR Hydration

Status: Accepted (2026-09-12, Phase 5 Sub-Phase 5.10).

## Context

Public catalog pages must prerender for SEO while the production build
has no backend at build time (relative same-origin `/api`), and
hydration must neither mismatch nor duplicate requests. An early
attempt that fetched unconditionally in `ngOnInit` hung the prerender
until timeout — server fetching cannot be assumed.

## Decision

Idle shell prerender plus transfer-on-settle plus document metadata:

- The page skips data loads off-browser (`isPlatformBrowser` guard, the
  sanctioned pattern): the server always emits the identical idle
  shell, so hydration mismatches are structurally impossible.
- `CatalogState` integrates `TransferState` with per-query keys: the
  server stores settled pages (never failures); the browser consumes
  once (removed on read) and otherwise fetches live. The mechanism is
  unit-proven (reuse/miss/single-use/failure) and activates whenever a
  server render settles loads — including future runtime SSR — without
  changing the page.
- Dynamic `Title`/`Meta` (title, description, OpenGraph) apply in
  `ngOnInit` — the only catalog write in the server pass — and refresh
  in an effect on query/category/culture changes. The prerendered
  `/catalog` HTML was verified to carry the tags.
- Proof is behavioral: a server-platform unit test (no fetch, idle
  shell, metadata still applied), a live-state single-fetch regression
  test, and green prerender builds.

## Consequences

- SEO pages render fast, stable shells with correct metadata today and
  gain server data automatically if a backend becomes reachable at
  render time — no page changes required.
- No `window`/`document`/`localStorage` exists anywhere in catalog
  production code (audit-verified); the only platform seams are
  `PLATFORM_ID` guards and SSR-safe Angular services.
