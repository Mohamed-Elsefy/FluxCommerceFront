# ADR 003 — Single-Flight Refresh & Centralized 401 Recovery

Status: Accepted (2026-09-09, Phase 2 Sub-Phases 2.6/2.7).

## Context

Concurrent requests expiring together must not stampede
`POST /auth/refresh` (rotating tokens make all-but-one racer fail), and
token attachment plus retry must not scatter across feature services.
Phase 1 left two seams for exactly this: `ACCESS_TOKEN_PROVIDER` and the
interceptor pipeline order.

## Decision

- `TokenRefreshService` (`libs/auth`, placed there to avoid an
  `api ↔ auth` barrel cycle) owns renewal: one shared execution per burst
  (`shareReplay`), rotated-pair publication to memory + storage,
  full cleanup + `false` on any failure, total (never-throwing) contract
  for pipeline composition.
- `authRecoveryInterceptor` (`libs/api`) sits upstream of injection so
  retries re-enter token attachment. It recovers only normalized
  `ApiError` 401s on eligible endpoints (login/register/refresh excluded
  by URL), retries each request at most once (retried clones tracked in a
  `WeakSet`), and falls back to the original error on decline or provider
  fault. Teardown propagates, so aborted callers dispatch no retry.
- Both seams follow the Phase 1 provider-override pattern
  (`provideAccessToken()`, `provideAuthRecovery()`), keeping `libs/api`
  free of auth state.

## Consequences

- Features write no auth headers and no retry logic; steady-state recovery
  is invisible to them (proven by pipeline tests: 3 concurrent 401s → 1
  refresh → 3 retried successes).
- Retry storms and infinite refresh loops are structurally excluded
  (single attempt per execution, single retry per request, refresh
  endpoint never re-enters).
- Late joiners after termination start a fresh execution — the known
  rotation hazard outside a burst, funneled into sharing by routing all
  401s through this path.
