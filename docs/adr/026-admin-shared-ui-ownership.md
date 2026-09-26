# ADR 026 — Admin-Owned Shared UI Primitives

Status: Accepted (2026-09-26, Phase 12: table/pagination in 12.5, filters/forms in 12.6, dialog/notifications in 12.7).

## Context

Phase 12 commissions reusable admin UI foundations (generic table,
pagination, filter/form primitives, dialog, notifications) for Phases
13–14. Three homes were possible:

1. `libs/ui` — the shared presentation library. Blocked: the
   architecture audit pins a closed module set there (Sub-Phases
   3.4/3.10/3.12 scope stops), and several primitives need
   capabilities `libs/ui` must not have (the pager math lives in
   `@flux/api`; field errors resolve through `@flux/i18n`; the
   notification host reads a service) — `libs/ui` imports no
   `@flux/*` barrel by law.
2. Feature-owned (e.g. inside a Phase 13 catalog feature). Wrong
   direction: Phases 13 _and_ 14 need the same table/pager/dialog,
   so feature ownership would duplicate or force awkward upward
   sharing later.
3. Per-component duplication. Forbidden by the Phase 12.11 review.

## Decision

Admin UI primitives live as **admin-app-owned shared components**
under `apps/admin/src/app/shared/` (tables, pagination, filters,
forms, dialog, notifications), following the same one-folder
`ts/html/css/spec` convention and dumb-component rules as `libs/ui`
(inputs in, events out, token-only logical CSS, no business
knowledge, no HTTP) without entering `libs/ui` itself:

- They compose shared infrastructure instead of rebuilding it
  (`totalPagesOf`/`PagedResult` from `@flux/api`, async UI from
  `@flux/ui`, resolvers from `@flux/i18n`).
- They stay invisible to the storefront (no cross-app imports, no
  storefront bundle cost) and to the audit's `libs/ui` module set.
- The 12.11 audit guard forbids parallel _infrastructure_ rebuilds
  (`AdminApiClient`/`AdminAuthService`) while explicitly exempting
  these primitives as extensions, not duplicates.

## Consequences

- `verify-architecture.mjs` keeps enforcing the closed `libs/ui`
  set unchanged; admin shared components are covered by the generic
  boundary/direction checks.
- If a primitive ever proves genuinely cross-app (both portals need
  it), promoting it to `libs/ui` requires opening the module set
  deliberately — a new ADR, not drift.
- Phase 13/14 mount these primitives inside feature vertical
  slices; E2E integration coverage for them lands there (12.10
  records the gap).
