# ADR 019 — Authenticated Cart Lifecycle

Status: Accepted (2026-09-16, Phase 7 Sub-Phase 7.6).

## Context

Sub-Phase 7.5 delivered the anonymous branch (guest bootstrap, identity
bookmark, expiration recovery) behind `GuestCartService`, while
`CartState` already routed every operation by established identity
(guest vs authenticated endpoints). Sub-Phase 7.6 had to connect the
remaining half — the JWT session owned by `AuthService` (`libs/auth`) —
without leaking auth logic into the cart feature, without duplicating
the guest flow, without persisting the authenticated cart locally, and
without touching the 7.7 merge.

## Decision

Session-driven identity, owned by a new route-provided
`AuthenticatedCartService` next to `CartState`/`GuestCartService`:

- The service constructor runs an effect tracking `AuthService.status`
  only (cart signals read `untracked`, so settled responses can never
  reschedule it) and re-synchronizes on every login, logout, and
  session restoration — each route instance reacts wherever the user
  happens to be. Pages drive `synchronize()` explicitly only on error
  retry; first render flows through the effect, so init cannot
  double-fire.
- `synchronize()` stands by while restoration pends (never treats
  `initializing` as anonymous), establishes the authenticated cart when
  authenticated, and delegates to the guest lifecycle when anonymous.
  It never disturbs in-flight work (returns `EMPTY` under the §7.3
  one-at-a-time lock): a late guest response must never land in the
  authenticated slot, so a login racing a request skips the switch
  until the next explicit synchronize (near-unreachable — logins
  navigate and remount).
- Establishment is GET-first (`GET /cart`) with a single-shot
  get-or-create fallback (`POST /cart`) on the settled
  `Cart.CartNotFound` verdict; other failures surface. The echo is
  adopted only after validating the authenticated flags — a foreign
  cart can never be adopted. Nothing is persisted locally: refreshes
  re-authenticate via the lib's restoration, then reload from the
  backend.
- Adopting the authenticated identity resets the slot, so guest lines
  can never render under, mix with, or survive into the authenticated
  view. The STORED guest `cartId` is deliberately preserved (it is the
  7.7 merge input, not active state); logout re-enters the guest flow,
  which reloads that stored cart — pre-login continuity until 7.7.
- Product Details branches on the session for submission
  (authenticated → session cart with no-active-cart healing;
  anonymous → guest flow) while reusing the same machine, and gates
  the button on whichever identity the session holds. It borrows the
  lifecycle seams only (one-way, no cycle); a read-only `identity`
  seam on `GuestCartService` keeps it off cart state internals.

## Consequences

- Login, logout, and refresh behave deterministically wherever they
  happen, pinned by service tests (stubbed auth machine) and page
  tests with the REAL `AuthService` (genuine transitions).
- The 7.7 merge arrives with its input intact (stored guest id) and a
  clean active state to replace — no 7.6 code paths need revisiting.
- Authenticated submission is unparked (ADR 018's interim ends);
  authenticated reads/writes that need no session branching were
  already routed by identity kind since 7.3.
