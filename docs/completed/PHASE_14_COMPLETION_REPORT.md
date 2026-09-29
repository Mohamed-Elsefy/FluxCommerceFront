# Phase 14 — Admin Orders & Payments: Completion Report

Status: **Complete** — 2026-09-29.

Phase 14 turns the Admin Portal from a catalog/inventory management
interface into a full commerce-operations surface for Orders and
Payments, built on the Phase 12 foundation and its shell, navigation,
tables, pagination, filters, forms, dialogs, notifications,
localization, RTL/LTR, theming, authorization, and testing
infrastructure. All eleven sub-phases (14.1–14.11) are done in
dependency order. The baseline is ready for **Phase 15 — Final QA &
Optimization**.

Related references: `docs/PROJECT_CONTEXT.md` (§35),
`docs/ARCHITECTURE.md` (as-built notes in §§4–5, 9, 22),
`docs/phases/PHASE_14_ADMIN_ORDERS_PAYMENTS.md`,
`docs/adr/029–030`.

The final boundary holds: the Admin Portal submits reads and displays
the resulting backend state; the backend owns business truth,
orchestration, authorization, and ownership. No endpoint, list,
filter, sort, payment linkage, history record, mutation, threshold, or
response model was invented — every contract gap stays pinned in code,
docs, or tests instead of fabricated.

---

## 1. Sub-phase summary

```text
14.1 Foundation & Backend Contract Alignment
     Audited the exact Admin/Backend boundary before any business code:
     the four order endpoints plus the two SPA-callable payment reads
     (webhook excluded by design), string wire statuses, the
     caller-owned list limitation (no platform-wide admin list), the
     no-filter/no-sort matrix, the missing payment linkage and history,
     and the admin route conventions. Delivered as
     `orders-payments-contract.ts` + 31 specs in `libs/models` (pure
     types + pure functions, no feature code) and ADR-029. No
     unresolved API assumptions remain.

14.2 Admin Orders Feature Foundation
     Created `features/orders/` (pages/data-access/state/models/
     `orders.routes.ts`), the `OrdersAdminApiService` read façade
     (`listOrders` + `getOrder`), route-provided `OrdersOverviewState`,
     the landing page with the backend-issued total, the `orders` lazy
     boundary under the guarded shell, sidebar entry, and
     `layout.nav.orders` in five cultures. No business UI yet —
     routable, authorized, connected.

14.3 Orders List & Pagination
     End-to-end orders list on the real contract: paged table (order
     number, verbatim status, culture-formatted total, item count,
     created date) with the response-effective pager; status as wire
     text (badge deferred to 14.4 by design); deep links stubbed out
     (details route absent) and wired in 14.5. No server sort/filter/
     search exists on order rows — omitted by design, documented in
     code.

14.4 Orders Filtering & Status Presentation
     Contract gate applied: the supported filter/sort set is empty, so
     no filter bar, no debounce, and no filter-driven reloads ship
     (absence pinned in E2E). Created the admin-owned `OrderStatusBadge`
     (localized labels + tones over `flux-badge`, verbatim + neutral
     fallback) behind the single `orderStatusDisplay` map, and extended
     the shared table with spec-pinned per-column cell templates so the
     badge renders inside cells. Testing the extension caught and fixed
     a real defect (outlet context carried the column-loop `$index`
     instead of the row index).

14.5 Order Details & Customer Information
     Order details over `GET /orders/{orderId}` with `untracked`
     route-param effects and supersede-on-navigate: header (order
     number + badge), backend-verbatim facts (totals, counts,
     timestamps), line-items table, and the address-backed customer
     information (the complete customer data — no user/customer
     identity exists on the payload). List rows deep-link here; 404s
     (including masked strangers) render the shared error state, never
     probed.

14.6 Payment Integration & Order-Payment Presentation
     Payment section on the details page through the ONLY supported
     linkage (by-order initialization chained into the single payment
     read, independent slot so payment failures never hide order
     facts): status (verbatim — badge deferred to 14.7), intent
     reference, provider, amount. The live `clientSecret` is discarded
     at the mapping boundary by construction (spec-pinned: no such
     field). Failures branch status-first: 404 empty, 409 retryable,
     else error. Presentation stays inside the Orders feature — no
     separate payments feature, route, or nav entry.

14.7 Payment Details, Status & Failed Payments
     Created the admin-owned `PaymentStatusBadge` behind the single
     `paymentStatusDisplay` map (all six backend states with tones,
     verbatim + neutral fallback, order-only values unmapped) and wired
     it into the payment section. Failed payments render the
     backend-supplied `Failed` status with the `danger` tone — no
     failure reason exists on the wire, so none is invented.

14.8 Payment History
     Re-audited the corpus: exactly three payment endpoints exist, no
     history/timeline/transition endpoint anywhere. No history UI ships
     and none is simulated. Recorded as test-pinned
     `PAYMENT_HISTORY_SUPPORTED = false` plus a data-access absence
     guard against history-shaped methods.

14.9 Localization, RTL, Responsive & Accessibility Hardening
     Audit pass: zero hardcoded UI strings, logical-properties-only
     CSS, full ARIA labelling, native-only interactive elements.
     One real fix (facts `dd` gains the conventional
     `overflow-wrap: anywhere` so order numbers and `pi_*` references
     cannot force overflow at 375px) plus RTL (`ar`) render tests for
     landing, list, and details with key-leakage assertions.

14.10 Orders & Payments E2E + Integration Verification
      15 Playwright journeys (`e2e/admin-orders.spec.ts`, mocked
      transports, new `admin-orders-chromium` project) green:
      landing, list + pager + details navigation, response-effective
      pagination, empty/error/retry paths, unknown-order error,
      details facts/addresses/items, payment facts, failed-payment
      status, missing-payment empty, unready-payment retry recovery,
      customer→forbidden, French chrome, RTL chrome. Pre-existing
      admin suites re-verified green with the extended navigation.

14.11 Phase Verification, E2E & Documentation (this sub-phase)
      Full matrix green (below); ADR-030; this report; DoD
      checkboxes; PROJECT_CONTEXT/ARCHITECTURE sync.
```

---

## 2. Test coverage

```text
Unit/component (ng-test builders + raw vitest, executed):
  admin        88 files / 508 passed (14.2–14.9 slices: orders
                foundation through payment hardening, plus key-coverage,
                RTL, and lookup-failure specs)
  libs         60 files /  454 passed (14.1 audit module + spec;
                nothing else touched)
  storefront  119 files / 1363 passed (Phase 11 baseline, untouched
                by Phase 14 — re-verified green in 14.11)

Architecture: 106/106 checks passed (no script changes needed in
              Phase 14 — the shared-table cell-template extension
              follows the sanctioned ADR-028 pattern)

E2E (playwright, mocked transports, executed):
  admin-orders             15 passed (landing, list/pager/details,
                           empty/error/retry, unknown-order error,
                           payment facts/failed/missing/unready,
                           customer→forbidden, French + RTL chrome)
  admin-auth               15 passed (access control + 12.10 journeys,
                           re-verified with extended navigation)
  admin-catalog            15 passed (13 catalog/inventory + 2
                           inventory-onboarding journeys, re-verified
                           with extended navigation)
  admin smoke               1 passed (chromium)

Production builds: storefront SSR + 15/15 prerendered routes;
  admin CSR with per-page lazy chunks (orders home/list/details);
  zero budget warnings.
```

---

## 3. Verification results

```text
verify-architecture         106/106 checks passed
typecheck                   storefront, admin, libs, specs — 0 errors
lint (prettier + eslint)    0 errors
build:storefront            SSR + 15 prerendered routes — 0 errors
build:admin                 CSR, all lazy route chunks — 0 errors
test:unit                   100% pass (admin 508, libs 454,
                            storefront 1363)
test:e2e (admin scope)      46 passed (15 orders + 15 auth + 15
                            catalog/inventory + 1 smoke),
                            mocked transports
responsive probes           scroll-safe tables, auto-fit grids,
                            wrapping facts, token-only logical CSS;
                            audit-enforced
```

---

## 4. Definition of Done (Phase 14 §DoD — item-by-item)

```text
Contract
[x] Orders contracts reviewed (14.1 audit + ADR-029; handler
    ownership verified in backend source during 14.11)
[x] Payment contracts reviewed (same; webhook pinned Stripe-only)
[x] Supported filters identified (the supported set is EMPTY — no
    filter UI by design, absence E2E-pinned)
[x] Pagination contract verified (GET /orders only; response-effective
    pager; E2E-covered page turns)
[x] Order status enums verified (Pending|Cancelled|Confirmed strings)
[x] Payment status enums verified (six strings, all badged)
[x] Payment linkage verified (by-order chain is the ONLY linkage;
    no order payload carries payment fields)
[x] Payment history availability verified (absent — test-pinned
    PAYMENT_HISTORY_SUPPORTED=false)
[x] Contract gaps documented (14.1 module, ADR-029/030, code docs,
    this report §5)

Orders
[x] Orders feature created (14.2: pages/data-access/state/models/
    routes, route-provided, no global store)
[x] Orders routes added (landing + list + :id lazy boundary;
    static `list` precedes `:id`)
[x] Orders API integration completed (listOrders/getOrder +
    paymentByOrder/getPayment façade over ApiClient)
[x] Orders List implemented (14.3: sanctioned table, contract fields
    only, row deep-links)
[x] Pagination implemented (14.3: server-side, response-effective)
[x] Supported filters implemented (none exist — absence by design)
[x] Order status presentation implemented (14.4: badge + localized
    labels, single map, verbatim fallback)
[x] Order Details implemented (14.5: facts, items table, addresses,
    loading/error/retry, masked-404 handling)
[x] Customer information implemented (14.5: shipping/billing address
    echo — the complete contract-backed customer data)

Payments
[x] Payment integration completed where supported (14.6: by-order
    chain inside the Orders feature; clientSecret discarded)
[x] Payment status presentation implemented (14.7: badge, all six
    states, localized)
[x] Payment details implemented where supported (14.6: reference,
    provider, amount — no method field exists)
[x] Failed payment presentation implemented where supported (14.7:
    Failed badge; no reason exists to display)
[x] Payment history implemented where supported (unsupported —
    documented, not fabricated)
[x] Unsupported payment capabilities documented (history, list,
    mutations, method, reasons — all pinned)

UX
[x] Localization complete (orders.* + paymentStatus.* + layout nav
    keys in 5 cultures; key-parity specs)
[x] Locale key parity verified (per-key per-culture specs, no
    key-path leakage incl. RTL)
[x] RTL/LTR verified (logical CSS only, audit-enforced; ar render
    specs; RTL E2E journey)
[x] Responsive behavior verified (scroll-safe tables, auto-fit
    grids, wrapping facts incl. the 14.9 overflow fix)
[x] Accessibility verified (labels, badges as text, focus states,
    native controls; audit 3.11)
[x] Loading states verified (resource slots + shared async UI;
    section-independent lifecycles)
[x] Empty states verified (landing/list/items/payment-404 paths
    unit- and E2E-covered)
[x] Error states verified (404/409/generic + retry paths unit-
    and E2E-covered)

Testing
[x] Unit tests added (§2)
[x] Component tests added (§2)
[x] API mapping tested (façade delegation + envelope passthrough)
[x] Pagination tested (state + pager + E2E page turns)
[x] Filtering tested (absence pinned — no filter contract exists)
[x] Order Details tested (state + page + E2E journey)
[x] Payment states tested (badge maps + section + E2E journeys)
[x] E2E critical flow tested (§2)
[x] Existing test suite remains green (§2)

Architecture & Documentation
[x] Architecture checks pass (106/106)
[x] Authorization verified (shell guards + customer→forbidden E2E;
    backend stays authoritative; caller-owned reads UX-noted)
[x] No direct component API access (audit-enforced; ApiClient only)
[x] No duplicated data-table implementation (one sanctioned
    extension, spec-pinned)
[x] No cross-feature boundary violations (audit 106/106; orders
    imports no catalog/inventory internals)
[x] Performance reviewed (route-level states, supersede-or-retry
    concurrency, response-effective pager, per-page lazy chunks;
    no new stores, no polling loops)
[x] `PROJECT_CONTEXT.md` updated (§35 marked Complete)
[x] `ARCHITECTURE.md` updated (§§4–5, 9, 22 as-built)
[x] Phase 14 completion documented (14.11)
```

---

## 5. Known limitations

- The admin orders list is caller-owned: the backend exposes no
  platform-wide orders endpoint (`GetMyOrders` filters by JWT
  identity with no admin bypass — verified in source). An admin who
  never checked out sees zero rows by contract, not by defect. The
  empty state names the scope; the E2E suite covers it. A backend
  `GET /admin/orders` (or equivalent) is the only fix — the frontend
  must not fabricate it.
- Order rows offer no search, filter, or sort for the same reason
  (paging params only); the list pages newest-first by server order.
- Customer information is the address echo only (no user/customer
  identity, email, or phone exists on any order payload).
- Payment linkage is read-only and order-initiated (by-order chain);
  terminal payments surface as retryable `409` (indistinguishable
  from saga-lag `NotReady` on the wire — status-first handling).
- No payment method, failure reason, or history exists anywhere on
  the HTTP surface; `Failed` renders as status-only by design.
- No admin order/payment mutations exist (cancel/confirm/refund) —
  none were built, none are reachable from the UI.
- The fetched `clientSecret` is intentionally unusable in the admin
  (discarded at the mapping boundary; no Stripe.js, no provider
  integration).
- Variant creation provisions no stock (backend design: `VariantCreated`
  stays inside the Catalog module; Inventory subscribes to nothing
  from Catalog). The admin now onboards SKUs through the inventory
  `New item` page (see §7) instead.

---

## 6. Deferred work (explicit non-goals)

```text
Phase 15 — Final QA & Optimization: system-wide matrix, live-backend
           confirmation, final performance/bundle review
Backend    — platform-wide admin orders list, order search/filter/
           sort, payment history/timeline, payment method + failure
           reason fields, admin order/payment mutations, variant→stock
           auto-provisioning (all absent from the HTTP surface;
           frontend must not invent them)
```

---

## 7. Adjacent delivery (outside Phase 14 scope, user-requested)

A live-backend investigation (new variant SKUs 404 on every
inventory read) confirmed the backend provisions no stock on variant
creation and the admin had no onboarding UI (`POST /inventory` was
wired but uncalled). Delivered against the same Phase 12/13
conventions in the same baseline:

```text
Inventory New item page (/inventory/new: SKU + on-hand form with
  zero admitted, backend-returned created record, 5-culture copy,
  landing card, unit/component specs, 2 E2E journeys)
Adjustments 404 guidance (names the untracked SKU, links to
  prefilled /inventory/new?sku=)
```

This closes the onboarding gap but changes nothing about backend
provisioning: variants still create no stock server-side.

---

## 8. Documentation changes in this phase

```text
docs/completed/PHASE_14_COMPLETION_REPORT.md   created (this file)
docs/PROJECT_CONTEXT.md                       §35 marked Complete
docs/ARCHITECTURE.md                          §§4–5, 9, 22 as-built
docs/adr/029-...-contract-alignment.md        created (14.1)
docs/adr/030-...-integration.md               created (14.2–14.10)
docs/phases/PHASE_14_ADMIN_ORDERS_PAYMENTS.md DoD checkboxes marked
libs/models (orders-payments-contract.ts +    14.1 audit module +
  .spec.ts)                                   31 tests
e2e/admin-orders.spec.ts                      15 journeys (14.10)
playwright.config.ts                          admin-orders-chromium
                                              project (14.10)
apps/admin (features/orders, shared           built across 14.2–14.9
            data-table cell-template          (third sanctioned table
            extension, navigation,            extension — extend with
            layout bundle)                    specs, never fork)
scripts/verify-architecture.mjs               unchanged in Phase 14
```

---

## 9. Phase 15 handoff

```text
The Admin Portal now manages orders end to end against the real
backend contracts — list (caller-owned), details with customer
information, and payment presentation with lifecycle honesty — plus
inventory item onboarding, all verified:
  - admin app builds and tests green (508 unit + 46 E2E); audit 106/106
  - shared libs untouched except the additive 14.1 audit module
  - data-table cell templates are the sanctioned pattern for future
    row-level needs (extend with specs, never fork)
  - open items for later: platform-wide admin orders endpoint,
    order search/filter/sort, payment history/method/reasons, admin
    mutations, variant→stock auto-provisioning (all backend),
    live-backend confirmations (Phase 15)
Next: Phase 15 — Final QA & Optimization.
```

(End of file)
