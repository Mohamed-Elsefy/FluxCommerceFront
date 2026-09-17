# ADR 021 — Payment Contract & Architecture Audit (Sub-Phase 9.1)

Status: Accepted (2026-09-17, Phase 9 Sub-Phase 9.1).

## Context

Sub-Phase 9.1 had to fix the exact Frontend/Backend payment boundary
before any payment code exists: which DTOs the SPA consumes, which
identifiers travel where, which payment states reach the UI, and who
owns what. The audit sources are `docs/frontend-contract/API_CONTRACT.md`
§6, `DTO_REFERENCE.md` §6, `ENUM_REFERENCE.md` §5, `ERROR_CATALOG.md` §6,
and `PAYMENT_INTEGRATION_NOTES.md`.

## Decision

### 1. Audited contract (the complete HTTP surface today)

- `GET /api/payments/{paymentId}` → `ApiResponse<PaymentResponse>` is the
  ONLY payment endpoint the SPA may call (authenticated + ownership,
  foreign ids mask as `404`). Mirrored canonically in
  `libs/models/.../domains/payments.ts`; aliased as `Payment` in the new
  `payment-contract.ts` audit module, never re-declared.
- `POST /api/payments/webhook` is Stripe→API only (raw body +
  `Stripe-Signature`, `200` empty on processed AND duplicate). The SPA
  never calls it; `isSpaCallablePaymentEndpoint` returns `false` for it
  and `SPA_CALLABLE_PAYMENT_ENDPOINTS` lists only the status read.
- No client-secret HTTP endpoint exists (blocker). The intent result
  (`PaymentIntentResult{StripePaymentIntentId,Status,ClientSecret}`) is
  application-layer only, and duplicates return `ClientSecret: null` by
  design. The initialization shapes (`PaymentInitializationRequest`
  `{orderId}`, `PaymentInitializationResult`
  `{paymentId,orderId,clientSecret,paymentReference,status}`) are
  documented as the FUTURE contract, pinned by
  `PAYMENT_INIT_HTTP_AVAILABLE = false` so no later sub-phase wires
  `confirmCardPayment` against a missing endpoint. Until it lands, the
  SPA polls `GET /orders/{id}` (`Pending → Confirmed|Cancelled`) as the
  payment proxy (`toPaymentAttemptFromOrder`, `orderPaymentProxyOf`).

### 2. Frontend models

- `Order` → alias of `OrderDetailsResponse` (`PaymentOrder`); entry →
  alias of `CheckoutResponse` (`PaymentOrderEntry`, the Phase 8 handoff
  carrying only `orderId`).
- `Payment` → alias of `PaymentResponse` (amount/currency echo verbatim,
  display only — no math anywhere in the module).
- `PaymentAttempt` → frontend-side observation record
  `{orderId,paymentId,status,providerReference,source,observedAtUtc}`
  with `source: status-query | provider-confirmation | order-poll`. The
  backend exposes no attempt DTO; this record is never sent.
- `PaymentStatus` → the existing string union
  (`Pending|Processing|Succeeded|Failed|Cancelled|Refunded`) with
  classifiers: terminal (`Succeeded|Failed|Cancelled|Refunded`, unknown
  futures stay non-terminal), success only via backend `Succeeded`,
  retryable `Failed|Cancelled` (never `Refunded`), payable
  `Pending|Processing` (`CanBePaid`), in-flight spinner states, and
  status-first error classifiers (`404` masked, `401` auth).
- Confirmation expectations: `PaymentConfirmationInput`
  `{clientSecret}` plus the closed `ProviderConfirmationOutcome` set
  (`succeeded|failed|cancelled|requiresAction|pending|unknown`), where
  `unknown` must resolve via status query first — never blind-retry.

### 3. Responsibility boundary

Frontend owns `payment-ux, provider-integration, feature-state,
payment-result-display, navigation, loading-error-handling`. Backend owns
`payment-creation, status-verification, webhook-processing,
order-transitions, inventory-coordination, saga-orchestration,
compensation, idempotency`. The two sets are disjoint by construction
(test-pinned) — zero business-logic duplication: no client-side
verification, no saga management, no webhook handling, no inventory
moves, no idempotency minting, no money computation.

### 4. Sensitive-data rule

`clientSecret` lives in memory only. `FORBIDDEN_CLIENT_SECRET_SINKS`
pins `localStorage, sessionStorage, url, logs, telemetry,
persistent-global-state` as forbidden; the only SPA-held Stripe key is
the publishable key from app env (`SPA_STRIPE_KEY_SLOT`).

### 5. Placement (scope discipline)

The audit lives in `libs/models` (shared contracts), NOT in a
`features/payments/` folder — no feature structure (9.2), no API service
(9.3), no signal store (9.4), no Stripe SDK (9.5), no components/routes
were created. The module is pure types + pure functions: no Angular, no
`HttpClient`, no browser APIs, no Stripe imports — SSR-safe.

## Consequences

- Sub-Phases 9.2+ build on pinned, tested shapes instead of assumptions;
  the initialization blocker is explicit rather than discovered mid-UI.
- `libs/models` gains `payment-contract.ts` +
  `payment-contract.spec.ts` (contract shapes, DTO mappings, status and
  boundary classifiers); no payment feature code exists yet.
- Verification: `npm run lint`, `npm run typecheck`,
  `npm run build:storefront`, `npm run build:admin`, `npm run test:unit`,
  `node scripts/verify-architecture.mjs` all green with 0 errors.
