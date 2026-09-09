# ADR 002 — Token Storage Strategy & SSR Safety

Status: Accepted (2026-09-09, Phase 2 Sub-Phase 2.3).

## Context

The backend issues a short-lived access JWT (15m) and a rotating opaque
refresh token (7d); auth is Bearer-based with no cookie contract
(`docs/frontend-contract/AUTH_FLOW.md` §2). The frontend must persist
enough to restore sessions across reloads without breaking Angular SSR
(no `localStorage` on the server, no per-user leakage into rendered HTML)
and without widening XSS exposure beyond what a Bearer SPA inherently has.

## Decision

Split persistence by lifetime: the refresh token plus the `CurrentUser`
snapshot persist in `localStorage` under a versioned key
(`fluxcommerce.auth.session.v1`) via `TokenStorageService`; the access
JWT lives only in `AuthService` memory and is re-minted through
`POST /auth/refresh` on every boot. Every storage method is
platform-guarded (`isPlatformBrowser`: server reads return `null`, writes
are no-ops) and exception-safe (private-mode denials, quota errors, and
corrupt payloads degrade to null/no-op, never throw). Passwords and
email/reset tokens are never stored anywhere.

## Consequences

- SSR always renders the anonymous/initializing shell; the browser
  reconciles post-hydration (verified error-free on the production bundle
  in Sub-Phase 2.15).
- `httpOnly` cookies would be strictly safer against XSS but require a
  backend cookie contract that does not exist — adopting one would be
  contract drift. Revisit this ADR if such a contract lands.
- Rotation bounds theft impact: reuse of a revoked refresh token yields
  `401 InvalidToken`, and logout revokes server-side.
