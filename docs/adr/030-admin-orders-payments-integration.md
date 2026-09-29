# ADR 030 — Admin Orders & Payments Integration (Sub-Phases 14.2–14.10)

Status: Accepted (2026-09-29, Phase 14 Sub-Phases 14.2–14.10).

## Context

Sub-Phases 14.2–14.10 turn the 14.1 contract audit
(`libs/models/.../orders-payments-contract.ts`, ADR-029) into the
working Admin Orders vertical slice: feature foundation, paged list,
status presentation, details with customer information, payment
integration, payment states, the history verdict, hardening, and E2E.
The audit pins hard constraints — caller-owned list only, no
filter/sort params, no payment fields on any order payload, no history
endpoint, no admin mutations — and every slice below builds inside
them instead of around them.

## Decision

### 1. Caller-owned list, honest empty states

`GET /orders` returns the caller's own orders only (backend
`GetMyOrders` filters by JWT identity with no admin bypass — verified
in source during 14.11). There is NO platform-wide admin list, so the
list page renders whatever the caller owns and the empty state names
that scope instead of implying a global view. An admin who never
checked out sees zero rows by contract, not by defect.

### 2. No-filter/no-sort matrix holds — no filter UI ships

The supported filter/sort set is empty (14.1
`supportsAdminOrdersFiltering`/`supportsAdminOrdersSorting` return
`false` for every read), so 14.4 ships no filter bar, no debounce, and
no filter-driven reloads. The E2E suite pins the absence
(`admin-filter-bar` count 0 on the list) so a future filter cannot
arrive without a contract first.

### 3. Payment presentation stays inside the Orders feature

Per Phase 14 §14.6, payment renders as one section of the order
details page (`OrderPaymentState`, route-provided next to
`OrderDetailsState`) — no separate payments feature, route, or nav
entry. The linkage is the only supported one: by-order initialization
read chained into the single payment read. The live `clientSecret`
from the initialization payload is discarded at the mapping boundary
(`toOrderPaymentView` has no such field by construction, spec-pinned);
the admin never confirms cards.

### 4. Failure contract is status-first

`404` renders the empty notice (missing payment or masked stranger);
`409` renders the retryable notice (`NotReady` saga lag and
`NotPayable` terminal share the status with no machine code on the
wire, so both retry without message-text interpretation); anything
else renders the error state. The page branches on normalized HTTP
status only.

### 5. Shared table grows by extension, never by fork (third extension)

14.4 adds per-column cell templates to `AdminDataTable`
(`column.template` with `$implicit: row` plus `index`,
owner-provided content) so the status badge renders inside table
cells. Business-free and spec-pinned like the 13.3/13.6 extensions.
Testing the extension caught a real defect: the outlet context passed
the inner column loop's `$index` instead of the row index — fixed by
aliasing the row index explicitly.

### 6. Status badges are feature-owned dumb components over `flux-badge`

`OrderStatusBadge` (14.4) and `PaymentStatusBadge` (14.7) compose the
shared `flux-badge` primitive with the single feature-level maps
(`orderStatusDisplay`/`paymentStatusDisplay`): localized labels, tones,
verbatim + `neutral` fallback for unknown values, cross-concept values
unmapped (order/payment independence). Failed payments render the
backend-supplied `Failed` status with the `danger` tone — no failure
reason exists on the wire, so none is invented.

### 7. Payment history is unsupported — pinned, not built

14.8 re-audited the corpus: exactly three payment endpoints exist
(two SPA-callable reads plus the Stripe-only webhook). No history,
timeline, or transition endpoint exists, so no history UI ships and
none is simulated. The verdict is test-pinned in the feature
(`PAYMENT_HISTORY_SUPPORTED = false` plus a data-access absence
guard against history-shaped methods).

### 8. Placement (scope discipline)

All orders code lives in `features/orders/` (pages, components,
data-access, state, models, `orders.routes.ts`) plus the two
sanctioned touchpoints outside it: the `orders` lazy mount with its
sidebar entry and layout label, and the business-free table
extension. No global stores, no `libs/ui` additions (closed set),
no cross-feature imports — audit 106/106 unchanged, no script
changes needed.

## Consequences

- Sub-Phases 14.2–14.10 ship on pinned shapes: admin unit suite 88
  files / 508 passed; 15 mocked-transport orders E2E journeys green
  (`e2e/admin-orders.spec.ts`, new `admin-orders-chromium` project);
  pre-existing admin suites re-verified green; both builds green.
- Known backend gaps stay explicit rather than becoming frontend
  fabrications: caller-owned list only, no order filters/sort, no
  payment linkage on order payloads, no history, no admin
  order/payment mutations, `409` ambiguity. Each is pinned in code,
  docs, or tests — see `docs/completed/PHASE_14_COMPLETION_REPORT.md`.
- Verification: `tsc` (both apps, models lib, spec project),
  `vitest` (libs 60/454, admin 88/508, storefront 119/1363),
  `eslint`, `prettier`, `node scripts/verify-architecture.mjs`
  (106/106), `ng build storefront` (SSR + 15 prerendered routes) +
  `ng build admin` (CSR), Playwright admin scope (orders 15,
  auth 15, catalog 15, smoke 1) — all green with 0 errors.
