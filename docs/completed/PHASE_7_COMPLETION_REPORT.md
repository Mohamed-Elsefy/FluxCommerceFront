# Phase 7 — Shopping Cart: Completion Report

Status: **Complete** — 2026-09-16.

Phase 7 turns the Phase 6 purchasable variant into a complete guest and
authenticated cart experience: from a product page the customer adds
priced lines to a guest cart that survives reloads via the backend
contract, opens `/cart` to update quantities, remove lines, or clear,
logs in to trigger the atomic backend merge, and lands on the merged
authenticated cart — localized in five cultures, RTL-safe, responsive,
accessible, and covered from unit to E2E. All nine sub-phases
(7.1–7.9) are done in dependency order, and the project is ready for
**Phase 8 — Checkout**.

Related references: `docs/PROJECT_CONTEXT.md` (§28),
`docs/ARCHITECTURE.md` (§§5, 9, 19, 21),
`docs/phases/PHASE_7_SHOPPING_CART.md`, `docs/adr/018–020`.

The final boundary holds: carts are presented, never orchestrated —
no checkout, payment, order, shipping, inventory, or saga logic exists
in the Phase 7 touchpoints (audit-verified), and every total,
consolidation, and merge result comes from the backend contract.

---

## 1. Sub-phase summary

```text
7.1  Contracts & Foundation
     Feature-owned `Cart`/`CartItem` aliases over `@flux/models` (no
     drift), `CartTotals` with null-until-backend money slots (no local
     price math, ever), guest/authenticated identity shapes, resource
     lifecycle, and pure structural helpers.

7.2  API & Data Access
     Thin `CartApiService` over `ApiClient` covering all 13 endpoints
     (guest + authenticated + merge): canonical route templates, no
     envelope unwrapping, no error remapping, no token handling.

7.3  Feature State
     Route-provided `CartState` (local Signals, never global, no NgRx):
     load/add/update/remove/clear/merge routed by established identity,
     pessimistic one-at-a-time lock, backend-authoritative selectors.

7.4  Cart Page & UI
     `CartPage` composing `CartItems`/`CartItem`/`CartSummary`/
     `QuantityControl`: backend snapshots only (no line totals — the
     contract carries none), decorative thumbnail placeholders,
     `/checkout` navigation boundary only.

7.5  Guest Cart
     Opaque `cartId` bookmark in versioned localStorage (never cart
     contents), first-visit creation, stored-identity loads, and
     expiration recovery (404/400 verdicts → fresh cart).

7.6  Authenticated Cart
     Session-driven `AuthenticatedCartService` (login/logout/restore
     effect): GET-first establishment with get-or-create fallback, no
     guest/auth mixing, refresh retention from backend persistence.
     Product Details branches submission on the session.

7.7  Guest → Login → Cart Merge
     Stored id is the only trigger (no client eligibility gate — that
     would be custom merge logic); identity adopted before the POST;
     bookmark cleared on success or dead-source verdicts; failures keep
     it for retry; triple duplicate prevention (once-per-transition,
     quiescence lock, trigger removal).

7.8  UX, Localization, RTL & Accessibility
     Polite live-region success announcements, focus repair on
     remove/clear, three new status keys in all five cultures,
     logical-only CSS (audit-enforced), native-keyboard controls with
     visible focus, alert/status roles throughout.

7.9  Testing & Verification (this sub-phase)
     Transport integration spec (real ApiClient), 11-test Playwright
     cart suite with a stateful mock backend (mandatory journey +
     CRUD, persistence, duplicates, failure, viewports, RTL), and the
     `verify-phase-7.mjs` boundary audit (8/8).
```

---

## 2. Contract changes consumed mid-phase

The backend exposed customer-readable variant pricing
(`VariantResponse` / `CatalogVariantSummary` gain `unitPriceAmount` +
`currency`), lifting the ADR 016/017 parking exactly as specified —
see ADR 018. The details page now renders the backend-issued unit
price and mounts the button with the snapshot-sourced wire body;
authenticated submission unparked in 7.6. Availability stays
undisplayed (inventory reads remain `Admin`-only).

---

## 3. Verification results (2026-09-16)

```text
npm run lint                  Prettier + ESLint — 0 errors
npm run typecheck             all app/lib/spec targets — 0 errors
npm run build:storefront      SSR build — success
npm run build:admin           CSR build — success
npm run test:unit             storefront 667 + admin 20 + libs 352
                              = 1039 passed, 0 failed
npm run test:e2e              68 passed, 1 pre-existing skip
                              (culture-admin SSR neutrality)
verify-architecture.mjs       97/97 checks passed
verify-phase-7.mjs            8/8 boundary checks passed
```

The mandatory journey
(Home → Catalog → Product → Variant → price → Add → Cart → Login →
Merge → Authenticated Cart) passes end to end, including exact
merge-body assertion, bookmark death, and no-duplicate-state across
reload; duplicate-variant consolidation (2 + 3 = 5) is asserted
verbatim from the mock backend response.

---

## 4. Key architectural decisions

- Identity is established, never guessed: guest ids come from
  `POST /cart/guest`, the authenticated cart from `POST /cart`, and
  malformed echoes are contract violations (see ADR 015 pattern).
- Storage holds one opaque string; everything else is backend echo —
  the independent-frontend-persistence trap stays unsprung.
- Cross-feature reuse travels through narrow documented seams (cart
  lifecycle services borrowed one-way by product-details, ADRs
  018–020) — no shared cart library, no cycles.
- Effects track one concern each (auth status, route id) with
  `untracked` discipline; in-flight work is never disturbed by
  transitions (quiescence guards everywhere).
- Tests caught real issues: sync-settle blindness in the announcement
  observer (fixed via handler-registered intent), `??`-swallowed test
  nulls, and E2E login-race aborts (fixed by waiting for the
  authenticated shell) — none waived.

---

## 5. Known limitations

- `test:e2e` needs the dev servers + Playwright browsers; cart/auth/
  catalog transports are mocked with backend-faithful semantics
  because no live backend runs here — the live contract path is
  proven by the HttpTestingController integration specs instead.
  Handlers isolate per suite for a future live switch.
- The product page boots one guest cart per visit before any add;
  rapid double-mounts can orphan an empty server-side guest cart
  (harmless — merge consumes or TTL clears; never user-visible).
- Backend copy (names, SKUs) renders verbatim as data, not UI copy,
  by design.

---

## 6. Deferred work (explicit non-goals)

```text
Phase 8 — Checkout: checkout page, addresses, shipping, order
          creation, payment/Stripe integration, order status
Phase 9+  — Payments UX, orders/account, admin portal
```

---

## 7. Documentation changes in this phase

```text
docs/completed/PHASE_7_COMPLETION_REPORT.md   created (this file)
docs/PROJECT_CONTEXT.md                       §28 marked Complete
docs/ARCHITECTURE.md                          §§19/21 as-built sync
docs/phases/PHASE_7_SHOPPING_CART.md          acceptance boxes checked
docs/adr/018-customer-readable-variant-pricing.md       created
docs/adr/019-authenticated-cart-lifecycle.md           created
docs/adr/020-guest-login-cart-merge.md                 created
scripts/verify-phase-7.mjs                    created (8/8)
package.json                                  verify:phase-7 script
e2e/cart.spec.ts + cart-chromium project      created (11 tests)
```
