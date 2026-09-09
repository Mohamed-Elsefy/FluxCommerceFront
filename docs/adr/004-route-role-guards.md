# ADR 004 — Route & Role Guards

Status: Accepted (2026-09-09, Phase 2 Sub-Phases 2.11/2.12).

## Context

Route protection must work uniformly across the Storefront and Admin
applications, respect the asynchronous restoration window, enforce the
backend role model (`Customer`/`Admin`/`SuperAdmin`), and stay decoupled
from features. Guards are navigation UX, never a security boundary — the
backend re-authorizes every request.

## Decision

- `authGuard` (`libs/auth`, functional `canActivate`): allows when
  authenticated; redirects anonymous navigation to `/login` with the
  attempted URL (query included) as `returnUrl` via returned `UrlTree`
  (never imperative `navigate`); while `initializing`, waits for
  `initialized` and decides exactly once. Treating `initializing` as
  anonymous is forbidden by design.
- `roleGuard` (`libs/auth`, functional, composed after `authGuard`):
  reads the allow-list from `route.data['roles']` with OR semantics,
  mirrors backend claims strictly (`SuperAdmin` does not imply `Admin` —
  list every admitted role), fails closed on missing/empty/non-string
  configuration, awaits initialization like `authGuard`, and redirects
  denials to `/forbidden` (anonymous callers reaching it directly also
  land there; login redirection stays `authGuard`'s job).
- Admin foundation wires `canActivate: [authGuard, roleGuard]` with
  `data: { roles: ['Admin', 'SuperAdmin'] }` on the `/dashboard` entry
  plus a lazy `/forbidden` page; the public root stays untouched so
  anonymous availability checks keep passing.

## Consequences

- Adding protection is one route-table line; role changes are data, not
  code.
- The Admin app ships no login route yet, so anonymous deep-link
  evaluation ends at the not-found fallback via `/login` — acceptable for
  the foundation; cross-app sign-in routing belongs to a later phase.
- Future account/customer routes reuse the same two guards without
  modification.
