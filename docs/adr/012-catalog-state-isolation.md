# ADR 012 — Catalog State Isolation

Status: Accepted (2026-09-12, Phase 5 Sub-Phases 5.1–5.3).

## Context

The first business feature (Catalog) needed state for discovery and
listing without creating a precedent for a global store. The
architecture (`ARCHITECTURE.md` §9) demands the smallest appropriate
scope, and the phase explicitly forbade NgRx, SignalStore, and global
Catalog state.

## Decision

Feature-scoped signal state with structural enforcement:

- `CatalogState` is `@Injectable()` with **no** `providedIn`, provided
  once on the parent `catalogRoutes` entry. Each catalog route subtree
  gets an independent instance; nothing outside the subtree can inject
  it. A unit test pins `providedIn !== 'root'` and per-site
  independence.
- Resource slots reuse the Phase 1 `createResourceState` primitive
  (idle → loading → success | empty | error, data retained across
  reloads, normalized `ApiError`s) — no new state machinery.
- The stateless `CatalogApiService` (`providedIn: 'root'`, like
  `IdentityApiService`) is the only feature code touching `ApiClient`;
  components never touch HTTP (lint + audit enforced).
- Data-access orchestration that reads the store from inside an effect
  must run `untracked`: `loadResourceState` reads the slot it later
  writes, which would otherwise register the slot as an effect
  dependency and refetch forever. This exact loop occurred, OOM-killed
  a test worker, and is now locked by a live-state regression test.

## Consequences

- Catalog state cannot leak globally by construction; later features
  (Cart, Checkout) follow the same route-provided pattern.
- Stale-request safety composes at the effect site (per-run
  `AbortController` + Phase 1.7 `cancelOnAbort`) instead of complicating
  the state service.
