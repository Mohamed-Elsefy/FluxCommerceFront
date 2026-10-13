# ADR 036 — Dashboard Analytics Alignment (Backend Analytics Evolution)

Status: Accepted.

## Context

The backend extended the analytics surface (audited in
`docs/frontend-contract/`): `GET /admin/dashboard` gained the
`days` window (default 30, `1..90`, else `400
Dashboard.ValidationFailed`), `recentPayments` (needs
`payments.read`), `recentUsers` (needs `users.read`), and
`dailySeries` (Succeeded-only per-currency revenue, zero-filled,
oldest-first); `PaymentAdminStatsResponse` gained
`refundedTotalsByCurrency`; and `Payment.ProviderUnavailable` on
`GET /api/payments/by-order/{orderId}` moved from the undocumented
`500` to the `400 Failure` default branch (retry). New codes carry
zero `CodeToKey` entries (English-fallback `detail`, localized
`title`).

## Decision

### 1. Canonical models (W1)

- `PaymentAdminStatsResponse` gains `refundedTotalsByCurrency`
  (same shape as `totalsByCurrency`).
- `AdminDashboardResponse` gains `recentPayments`,
  `recentUsers`, `dailySeries` (all required arrays, `[]` when
  unauthorized); `DailyRevenueResponse`/`DailySeriesPointResponse`
  are host-local types mirroring the DTO reference.
- `DashboardQuery` gains `days?`; `isValidDashboardQuery` enforces
  `1..90` (plus the existing threshold rule).
- Shared pure helper `netRevenueByCurrency` joins the two rollups
  (union of currencies, missing side zero) for display.

### 2. Provider-outage 400 classification (W2)

`isRetryableInitializationFailure` treats `400` on the bodiless
by-order init path as retryable within the 15-attempt budget: the
only other `400` there is `OrderIdRequired` for an empty guid,
which the UI flow can never send (the id comes from checkout), so
no meaningful distinction is lost and the budget bounds the worst
case. `401`/`403`/non-`NotReady` `409`s stay terminal.

### 3. Contract-sanctioned display math (W3–W4)

Net revenue per currency (succeeded − refunded) is computed
client-side on the admin stats landing and the dashboard payments
card, exactly as `API_CONTRACT.md` Appendix B.6 prescribes
("computed client-side"). This is the single sanctioned exception
to the no-client-math rule: values echo verbatim except the net
difference, which is formatted for display and never fed back
into requests. Amounts still arrive backend-authoritative; the
backend never nets refunds server-side.

### 4. Dashboard presentation (W4)

- Fixed window `days: 30` always sent (approved: no UI control).
- `recentPayments` renders for `payments.read` holders (or
  `SuperAdmin`) only — stats-only viewers keep stats but no list;
  `recentUsers` renders for `users.read` holders (or
  `SuperAdmin`); both drill into the existing details pages.
- `dailySeries` renders as custom SVG order bars (no new
  dependencies) over an always-rendered accessible day list
  (invariant UTC dates verbatim, culture-formatted amounts).
  The chart card renders only with points; the honest-empty
  dashboard still covers the no-entitlement case.

## Consequences

- `400`s on by-order init poll instead of failing fast; the
  `500 ProviderUnavailable` references are gone from code and
  comments (wire reality: business errors carry no machine code —
  classification stays status-first).
- Dashboard error semantics unchanged (`400` validation incl. the
  new `days` rule, `401` anonymous, first-failing-section errors);
  unauthorized sections stay `null`/`[]`, never 403.
- Verification: unit/component specs for every
  mapping/classifier/pre-check; `tsc`; architecture audit
  unchanged (no new stores, no `libs/ui` additions, no polling
  loops beyond the existing bounded poll budgets).
