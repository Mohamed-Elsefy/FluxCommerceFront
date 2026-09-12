# ADR 013 — Unified Catalog Query State

Status: Accepted (2026-09-12, Phase 5 Sub-Phases 5.4–5.7).

## Context

Search, category, filters, sort, and pagination could each have grown
independent query-string logic across components. The backend contract
(`CatalogSearchQuery`: `searchTerm/categoryId/status/visibility/sortBy/
sortDirection/pageNumber/pageSize`) is the fixed target, and the phase
required one coherent representation with page-reset semantics.

## Decision

One immutable UI-owned snapshot (`CatalogQueryState`) with a single
funnel to every consumer:

- UI names (`search/category/filters/sort/page/pageSize`) map to wire
  names exactly once in `toBackendQuery`; route params share the same
  backend field names through the same `toQueryParams` funnel, so URL
  and wire can never diverge into parallel query builders.
- Pure updaters return new snapshots (structural sharing, never
  mutation): `search`/`category`/`filters`/`sort`/`pageSize` changes
  reset `page` to 1; `setQueryPage` preserves everything with Phase 1
  clamping — pagination cannot lose the active query.
- Only backend-supported dimensions exist: `status`/`visibility`
  filters, `Name`/`CreatedAtUtc` sorts. Price and availability were
  requested by example text but do not exist in the catalog contract,
  so they are deliberately not offered (same rule kept price off the
  product card).
- Route parsing (`queryStateFromRouteParams`) is total: names or
  numbers, case-insensitive, garbage → field defaults. Unknown select
  tokens clear their dimension instead of producing backend 400s.

## Consequences

- Search (debounced URL commits), filters, sort, and pagination all
  commit through the same transitions; deep links round-trip the full
  state, proven by unit tests.
- Phase 6+ detail/cart flows reuse the funnel rather than inventing
  query logic.
