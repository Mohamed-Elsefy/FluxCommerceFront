# ADR 029 — Admin Orders & Payments Contract Alignment (Sub-Phase 14.1)

Status: Accepted (2026-09-28, Phase 14 Sub-Phase 14.1).

## Context

Sub-Phase 14.1 must fix the exact Admin/Backend integration boundary
before any Orders or Payments business functionality exists: which
endpoints the portal consumes, which DTOs travel where, which reads
paginate, which filters/sorts exist, how payments link to orders, which
admin routes the portal will mount, and who owns what. The audit
sources are `docs/frontend-contract/API_CONTRACT.md` §§4/6,
`DTO_REFERENCE.md` §§4/6, `ENUM_REFERENCE.md` §§3/5, `ERROR_CATALOG.md`
§§4/6, `PAGINATION_CONVENTION.md`, and `PAYMENT_INTEGRATION_NOTES.md`.

## Decision

### 1. Audited contract (the complete HTTP surface today)

- Orders (`[Route orders][Authorize]`, any authenticated JWT — NOT
  `Admin`-only): `GET /orders` (paged, caller-owned only, newest-first,
  `pageNumber`/`pageSize` only), `GET /orders/{orderId}`
  (ownership-masked `404`), `POST /orders/{orderId}/cancel`
  (`Pending`-only, `409 CancelConflict`). `POST /orders/checkout` is the
  customer purchase flow (cart-owned, `Idempotency-Key` required) and is
  never an admin operation — excluded from the callable table.
- Payments (`[Route api/payments][Authorize]`, note the inconsistent
  `api/` prefix): `GET /api/payments/{paymentId}` (ownership-masked
  `404`), `GET /api/payments/by-order/{orderId}` (live client secret,
  `409 NotReady` on saga lag → poll/retry, `409 NotPayable` on terminal
  payment, `500 ProviderUnavailable`). `POST /api/payments/webhook` is
  Stripe→API only and never appears in the SPA surface by design.
- Mirrored canonically in `libs/models/.../domains/orders.ts`,
  `payments.ts`, and `payment-contract.ts` (`PaymentInitializationResult`);
  aliased as `AdminOrderSummary`/`AdminOrderDetails`/`AdminPayment`/
  `AdminPaymentInitialization` in the new `orders-payments-contract.ts`
  audit module, never re-declared.
- Pagination exists ONLY on `GET /orders` (`pageNumber ≥ 1`,
  `1 ≤ pageSize ≤ 100`, defaults `1`/`20`); sorting exists NOWHERE
  (`GET /orders` is fixed newest-first, payment reads are
  single-resource); filtering exists NOWHERE (`GET /orders` takes paging
  params only). Both `supportsAdminOrdersSorting` and
  `supportsAdminOrdersFiltering` return `false` for every read — pinned
  so 14.4 cannot invent filter/sort controls.
- Order and payment `status` fields are STRINGS on the wire
  (`.ToString()`, never enums): `Pending|Cancelled|Confirmed` for
  orders, `Pending|Processing|Succeeded|Failed|Cancelled|Refunded` for
  payments. All timestamps in this slice are `DateTimeOffset`.

### 2. Contract gaps (documented, never fabricated)

- NO platform-wide admin orders list: `GET /orders` returns caller-owned
  orders only, so an admin JWT sees its own orders, never every
  customer's (`orders-list-all` pinned unsupported).
- NO order filters, search, or sorting on the backend (status, customer,
  date, text, sort params all absent).
- NO customer identity on any order payload (no `userId`/`customerId`/
  email/phone — addresses only), so customer information renders from
  the address echo or not at all (`order-customer-identity` unsupported).
- NO payment linkage on any order payload (no `paymentId`/payment
  status on summaries or details); the payment id for a known order
  arrives only via `GET /api/payments/by-order/{orderId}`
  (`order-payment-linkage` unsupported).
- NO payment list, NO payment history, NO failed-payments query
  (`payment-list`, `payment-history`, `failed-payments-list`
  unsupported — 14.8 must not invent `GET /orders/{id}/payments`).
- NO admin order/payment mutations: no confirm, no refund, no admin
  cancel beyond the owner-scoped `POST /orders/{id}/cancel`, no payment
  create/confirm/cancel/refund from the SPA.
- Payment failures have zero `CodeToKey` entries backend-side (English
  fallbacks) — classifiers stay status-first per `ERROR_CATALOG.md` §0.

### 3. Frontend models

- `AdminOrderSummary`/`AdminOrderDetails`/`AdminOrderLineItem`/
  `AdminOrderAddress`/`AdminOrderMoney` → aliases of the canonical order
  responses; `AdminPayment` → alias of `PaymentResponse`;
  `AdminPaymentInitialization` → alias of `PaymentInitializationResult`.
  Money echoes verbatim for display — no totals math, no float helpers.
- Admin query shapes are transport-only: `AdminOrderListQuery` (paging
  only), `AdminOrderDetailsQuery`/`AdminPaymentStatusQuery`/
  `AdminPaymentByOrderQuery` (single ids), plus structural pre-checks
  (`isValidAdminOrdersPagingQuery`, `isValidAdminOrderDetailsQuery`, …)
  that are never substitutes for backend validation.
- Status tables plus pure classifiers (`isAdminOrderStatus`,
  `isTerminalAdminOrderStatus`, `isPendingAdminOrderStatus`,
  `isTerminalAdminPaymentStatus`, `isSuccessfulAdminPaymentStatus`,
  `isFailedAdminPaymentStatus`, verbatim `adminOrderStatusOf`/
  `adminPaymentStatusOf` projections). Unknown future strings count as
  non-terminal (keep polling, per `ENUM_REFERENCE.md` §8).
- Failure classifiers are status-first (`isAdminOrdersNotFoundFailure`/
  `isAdminOrdersConflictFailure`/`isAdminOrdersValidationFailure`/
  `isAdminOrdersAuthFailure`), never message-text-based.

### 4. Responsibility boundary

Frontend owns `orders-ux, payment-presentation, feature-state,
loading-error-handling, navigation, notifications`. Backend owns
`order-state, payment-state, payment-verification, status-transitions,
pricing-rules, inventory-coordination, saga-orchestration, compensation,
webhook-processing, idempotency, validation, authorization, ownership`.
The two sets are disjoint by construction (test-pinned) — zero
business-logic duplication. Order `status` never implies payment
`status` and vice versa.

### 5. Route and placement conventions (settled in 14.1, built in 14.2+)

- Phase 14 mounts lazy `orders` and reserved `payments` children under
  the guarded portal shell (`ADMIN_PHASE_14_ROUTES`), with the existing
  `authGuard` + `roleGuard` chain over `ADMIN_PORTAL_ROLES`. Payment
  presentation stays inside the Orders feature unless contract and UI
  complexity justify a separate feature (per Phase 14 §14.6).
- Features follow `pages/components/data-access/state/models/
<feature>.routes.ts` with Signals-only state over the Phase 12 admin
  shared primitives; no global stores, no `libs/ui` additions (closed
  set, ADR-026).

### 6. Placement (scope discipline)

The audit lives in `libs/models` (shared contracts), NOT in
`features/orders/` — no feature structure (14.2), no API service, no
signal store, no components/routes were created. The module is pure
types + pure functions: no Angular, no `HttpClient`, no browser APIs —
SSR-safe.

File naming note: the module is `orders-payments-contract.ts` (not
`admin-…`) because the workspace ESLint `**admin**` import guard matches
any specifier containing that substring — even a library-internal
filename — and would false-positive (same reason as ADR-027). Exported
symbol names keep the `Admin*` prefix; only the filename avoids the
substring.

## Consequences

- Sub-Phases 14.2+ build on pinned, tested shapes instead of
  assumptions; the caller-owned list, the no-filter/no-sort matrix, the
  missing payment linkage/history, and the owner-scoped cancel are
  explicit rather than discovered mid-UI. 14.6–14.8 scope is determined
  by this gate: payment presentation renders only what the two payment
  reads return; history renders nothing (no contract).
- `libs/models` gains `orders-payments-contract.ts` +
  `orders-payments-contract.spec.ts` (31 tests: endpoint tables,
  unsupported-operation pins, paging/sort/filter matrix, query
  pre-checks, status tables/classifiers, route pins, status-first
  classifiers, disjoint responsibility sets); no admin feature code
  exists yet.
- Verification: `tsc` (models lib + spec project), `vitest` (models
  suite), `eslint`, `prettier`, and
  `node scripts/verify-architecture.mjs` all green with 0 errors.
