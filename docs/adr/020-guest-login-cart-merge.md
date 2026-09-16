# ADR 020 — Guest → Login → Cart Merge Trigger

Status: Accepted (2026-09-16, Phase 7 Sub-Phase 7.7).

## Context

Sub-Phase 7.6 left the merge deliberately unwired: login adopted the
authenticated identity while the stored guest `cartId` waited as the
future merge input. Sub-Phase 7.7 had to fire `POST /cart/merge` at the
right moment with the right guards — the backend owns the merge itself
(atomic Lua merge, duplicate handling, consistency, totals), so every
frontend decision here is about triggering, adoption, and failure
routing, never about merge behavior.

## Decision

Trigger in `AuthenticatedCartService.synchronize`, the single session
entry, whenever the session is authenticated AND a stored guest id
exists — covering both the login transition and the post-login mount
(the common path: login happens off-route, then navigation remounts
already authenticated):

- The stored id is the ONLY trigger condition. There is deliberately
  no client-side emptiness gate: the backend merge is authoritative and
  empty merges are server-side no-ops, while an eligibility check would
  be the custom merge orchestration §7.7 forbids.
- Identity is adopted BEFORE the merge posts, so the merged cart lands
  under the authenticated identity with no reset after (the 7.3
  transport already lands envelopes; no state change was needed).
- Success clears the local bookmark (the source died server-side).
  Dead-source verdicts (`Cart.CartNotFound`, masked
  `Cart.CartAccessDenied`, `Cart.InvalidCartId` — the 7.5 set) clear it
  and fall back to establishment; all other failures surface with the
  bookmark preserved, so page retry re-merges (safe: a lost success
  response retries into a cleared source → 404 → establishment loads
  the merged cart).
- Duplicates are prevented at three levels: the effect fires once per
  auth transition, the quiescence lock serializes overlapping
  synchronizes (a late guest response can never land in the auth
  slot), and success removes the trigger condition itself.
- Logout mid-merge is a no-op teardown (identity moved on); the 7.5
  guest recovery absorbs the orphaned bookmark gracefully.

## Consequences

- The mandatory `Guest → Login → Cart Merge → Authenticated Cart`
  journey works from any route, pinned by service tests (trigger,
  verbatim adoption, single-shot fallback, retry, no-double-merge)
  and page tests with the real `AuthService` (login merge rendering,
  bookmark cleared, logout continuity).
- No client code computes merge results: consolidated quantities are
  asserted verbatim from backend envelopes in tests.
- Phase 8 inherits a single established identity per session; the merge
  leaves no residual guest state behind.
