# Phase 10 — Orders & Customer Account: Completion Report

Status: **Complete** — 2026-09-22.

Phase 10 connects the completed Checkout and Payment flows with the
customer's post-purchase experience: from payment the customer follows
the `View order` seam to `/account/orders/:orderId`, reviews the
backend-verified order while bounded synchronization converges it, and
owns the full account area — profile, paginated orders list, order
details with independent localized status badges — localized in five
cultures, RTL-safe, responsive, accessible, and covered from unit to
E2E. All nine sub-phases (10.1–10.9) are done in dependency order, and
the project is ready for **Phase 11 — Storefront Production
Readiness**.

Related references: `docs/PROJECT_CONTEXT.md` (§31),
`docs/ARCHITECTURE.md` (§§5, 20),
`docs/phases/PHASE_10_ORDERS_CUSTOMER_ACCOUNT.md`,
`docs/frontend-contract/` (`API_CONTRACT.md` §4, `DTO_REFERENCE.md`
§4, `ENUM_REFERENCE.md` §§3/5, `ERROR_CATALOG.md` §4,
`AUTH_FLOW.md` §4, `PAGINATION_CONVENTION.md`).

The final boundary holds: Angular owns the account/order experience;
the backend owns order truth, payment truth, business orchestration,
authorization, and ownership. No admin functionality, no totals math,
no status derivation, and no fabricated contract capabilities exist
anywhere in the customer account area (E2E- and audit-pinned), and
every price, total, count, and status comes from the backend contract
(the suites fail if the UI ever computes or invents them).

---

## 1. Sub-phase summary

```text
10.1 Orders Contract Audit & Feature Foundation
     Backend orders surface audited (`GET /orders` paged summaries,
     `GET /orders/{id}` details, `POST /orders/{id}/cancel`,
     `GET /auth/me` profile; string statuses; `PagedResult`
     envelope; IDOR-masked ownership). Frontend `Order`/`OrderSummary`/
     `OrderItem`/`OrderStatus`/`PaymentStatus`/`OrderHistory`/
     `OrderPagination` models as aliases over `@flux/models` (no
     drift), thin `OrdersApiService` over `ApiClient` (canonical
     templates, envelope passthrough, `AbortSignal` forwarding), state
     boundary shapes, and the empty `ordersRoutes` placeholder with
     the Page → State → Data Access → ApiClient flow pinned.

10.2 Customer Account & Profile
     `accountRoutes` lazy boundary mounted at `account` (guarded shell
     with route-provided `AccountState` over `GET /auth/me` with
     session re-sync, profile page with loading/error/loaded states,
     read-only by contract — no edit surface exists), account shell
     with section nav (Profile, Orders) and single-flight logout,
     header `Account` entry for authenticated sessions, `authGuard`
     return-URL redirects for anonymous entry.

10.3 Orders List
     `OrdersListPage` with route-provided `OrdersListState` over the
     paged `GET /orders` contract (`normalizePagination` commits,
     response-effective pager values, in-flight pager lock), idle →
     loading → success / empty / error states with retry,
     presentational order rows (verbatim backend facts, details links)
     and a feature-owned pager (First/Previous/numbered/Next/Last,
     `aria-current`, boundary + in-flight disabled states).

10.4 Order Details
     `OrderDetailsPage` with route-provided `OrderDetailsState` over
     `GET /orders/{orderId}` (param-driven loads with in-place param
     handling, blank-id local failure), header facts, both address
     echoes, backend line items table, backend totals rows, and
     distinct loading / success / `404` / `403` / `401` / generic-error
     handling with back-to-list, sign-in, and retry recoveries.
     Contract-honest omissions pinned and tested: no payment status,
     no tax row, no thumbnails, no contact details beyond
     `recipientName` (no such contract fields).

10.5 Order & Payment Status Experience
     Feature-owned `OrderStatusBadge` / `PaymentStatusBadge`
     (tone-coded, localized labels, unknown-value verbatim fallback
     with `neutral` tone), independent `ORDER_STATUS_TONES` /
     `PAYMENT_STATUS_TONES` maps with cross-concept independence
     pinned both directions (a successful payment is never presented
     as a completed order), `orders.status.*` labels in five
     cultures, text-always accessibility (never color-only, audited
     token pairs), integrated into list rows and the details page.
     The payment badge ships tested but unwired: no order payload
     carries payment fields, and cross-feature internal imports are
     forbidden.

10.6 Order History & Post-Payment Synchronization
     History verified unsupported — no backend history contract
     exists, so no timeline was built (`ORDERS_HISTORY_SUPPORTED`
     stays `false`; absence is test-pinned). Bounded sync loop in
     `OrderDetailsState` (`timer` + `take` + `exhaustMap` cadence from
     the §9.9 payment poll: immediate read, 2s ticks, 30-tick budget,
     early terminal stop, stopping `401|403|404` errors surfaced at
     once, transient failures skipped, duplicate-loop prevention,
     teardown on destroy/navigation, id-change resets), auto-started
     browser-only from the details page with pending (`role=status`)
     and exhausted-plus-manual-recheck UI.

10.7 Routing, Authorization & Account UX
     Complete lazy route tree (`account` → `profile`/`orders` →
     `:orderId`, all deep-linkable, `:orderId` SSR `Server`-mode),
     `authGuard` on the account parent with return-URL redirects
     (route-tested end to end through the real tables), Payment
     Result → Order Details seam (success-block `View order` link
     with a five-culture key, inline destination — no cross-feature
     imports), and the documented rule that guards are UX protection
     only while the backend stays solely authoritative.

10.8 Localization, RTL, Responsive & Accessibility
     Template audit: zero hardcoded user-facing strings across
     account/orders (all copy through feature bundles); raw integer
     counts kept per the catalog precedent. CSS audit: zero
     physical-direction properties, canonical `48rem` breakpoint only,
     items table wrapped in a scroll container for narrow viewports.
     Focus management on all three pages (entry heading focus +
     once-per-failure error-banner focus, browser-guarded, checkout
     §8.8 pattern). Live semantics confirmed (`role=status` loading
     and sync notes, `role=alert` errors, scoped table columns,
     labelled navs, `aria-current` pager, visible focus indicators).
     Render-smoke tests prove identical content under RTL direction.

10.9 Testing, E2E & Phase Completion (this sub-phase)
     HTTP-level integration spec (real states + services + `ApiClient`
     against `HttpTestingController`: exact URLs/bodies, empty pages,
     dataless-`200` breach, `400`/`401`/`403`/`404` mapping, verbatim
     unknown statuses, bodiless cancel, profile adoption), five
     executable E2E customer journeys plus one provider-gated skip,
     this report, and the §31/`ARCHITECTURE.md` completion records.
```

---

## 2. Test coverage

```text
Unit/component/integration (vitest — storefront, admin, libs):
  storefront  115 files / 1321 passed (incl. 12-test HTTP
              integration spec: state → api → contract over the wire)
  admin         8 files /   20 passed (untouched by this phase)
  libs         56 files /  390 passed (untouched by this phase)

E2E (playwright — orders-chromium, mocked network boundary):
  Journey 1   Login → Account → Profile View                    passed
  Journey 2   Orders List → Pagination (committed page numbers)  passed
  Journey 3   Select Order → Details (backend facts)            passed
  Journey 4   Checkout → Order → Payment → Result hub           passed
              (failure path — no success invented; live-Stripe
              success → View order leg gated-skipped, documented)
  Journey 5   Processing → Bounded Polling → Terminal state     passed
              (sync note → Confirmed badge, reads within budget)
```

---

## 3. Verification results

```text
npm run lint                  prettier + eslint boundaries — 0 errors
npm run typecheck             storefront, admin, libs, specs — 0 errors
npm run build:storefront      SSR build + prerender — 0 errors
npm run build:admin           CSR build — 0 errors
npm run test:unit             100% pass (see §2)
npm run test:e2e              90 passed / 7 skipped / 0 failed across
                              all 97 suites (5 orders journeys green;
                              skips: 1 orders + 5 payments
                              provider-gated, 1 pre-existing culture
                              SSR skip — all documented)
node verify-architecture      102/102 checks passed
```

---

## 4. Definition of Done (Phase 10 §DoD — item-by-item)

```text
[x] Customer Account is available (`/account` shell + nav + logout)
[x] Customer Profile is displayed (read-only, backend `/auth/me`)
[x] Customer Orders List is available (paginated per contract)
[x] Orders are paginated according to the backend contract
[x] Order Details are available (backend fields only)
[x] Order Status is displayed correctly (localized badge + fallback)
[x] Payment Status is displayed correctly (localized badge + fallback;
    per-order values await a backend payment link — documented gap)
[x] Order History is displayed when supported (unsupported: no
    timeline built, absence pinned — §10.6.1 compliant)
[x] Post-payment synchronization works correctly (bounded loop)
[x] Polling is implemented only when required (saga eventual
    consistency — required, PAYMENT_INTEGRATION_NOTES §2)
[x] Polling is bounded and cancellable (30-tick budget, terminal
    stop, destroy/navigation teardown, no overlaps/duplicates)
[x] Authentication and ownership behavior is correct (guard UX +
    backend authority, masked 404s, return-URL flow tested)
[x] Loading states are implemented
[x] Empty states are implemented
[x] Error states are implemented (incl. distinct 401/403/404)
[x] Not-found behavior is implemented
[x] Localization is complete (5 cultures, dates/numbers/currency)
[x] RTL behavior is verified (logical CSS only, RTL render smokes)
[x] Responsive behavior is verified (fluid layouts, scroll tables)
[x] Accessibility is verified (headings, keyboard, focus, ARIA)
[x] Unit/component tests pass
[x] Critical E2E journeys pass
[x] Architecture verification passes
[x] Storefront build passes
[x] Admin build remains unaffected (no admin files touched)
[x] No Admin Orders/Payments functionality has been introduced
[x] No unnecessary architecture or state-management complexity has
    been introduced (signals only, no new libraries)
```

---

## 5. Known limitations

- E2E runs against `ng serve` with mocked transports (no live API in
  this environment); the mocked payloads are contract-exact, and the
  live-Stripe success → View order leg stays `describe.skip` with its
  enable condition until a runnable provider seam exists in E2E.
- Per-order payment status cannot render until the backend links
  orders to payments (no payment fields on any order payload); the
  tested `PaymentStatusBadge` is ready for that read.
- Order history cannot render until the backend exposes it
  (`ORDERS_HISTORY_SUPPORTED` is `false` by audit, not by omission).
- Integer counts render unformatted (catalog precedent); full
  locale-digit policy belongs to a cross-cutting pass if adopted.

---

## 6. Deferred work (explicit non-goals)

```text
Phase 11 — Storefront Production Readiness: SSR/SEO verification,
            performance, error pages, security review
Phase 14 — Admin Orders & Payments: order/payment administration
            (storefront-only implementation here)
```

---

## 7. Documentation changes in this phase

```text
docs/completed/PHASE_10_COMPLETION_REPORT.md   created (this file)
docs/PROJECT_CONTEXT.md                       §31 marked Complete
docs/ARCHITECTURE.md                          §5 as-built sync (§20
                                              polling note resolved)
e2e/orders.spec.ts + orders-chromium          created (5 passed /
                                              1 gated-skipped)
apps/.../features/orders/                     built across 10.1–10.8
apps/.../features/payments/                   result → order seam
                                              link + key (10.7)
libs/models, libs/api, libs/*                 untouched (no new
                                              shared surface)
scripts/verify-architecture.mjs               untouched (102/102)
```
