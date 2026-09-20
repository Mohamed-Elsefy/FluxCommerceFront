# ADR 022 — Payment Feature Architecture (Sub-Phases 9.3–9.12)

Status: Accepted (2026-09-19, Phase 9 Sub-Phases 9.3–9.12; audit: 9.1).

## Context

Sub-Phase 9.1 (`docs/adr/021-payment-contract-architecture-audit.md`)
fixed the payment contract surface and found the blocker shaping the
whole phase: the backend exposes NO client-secret HTTP endpoint, so
`initializePayment`/`confirmPayment` have no executable HTTP path, and
provider confirmation executes Stripe-side with webhook verification.
Sub-Phases 9.3–9.12 had to build a complete, tested payment feature on
that contract without inventing endpoints, duplicating backend
orchestration, or leaking provider specifics.

## Decision

1. **Contract-blocked operations short-circuit, never fabricate.**
   `PaymentApiService.initializePayment`/`confirmPayment` expose the
   §9.1 typed shapes and return a normalized `ApiError`
   (`PaymentContractBlocked`, zero HTTP calls, zero identifier echo)
   until the backend lands the paths. Inventing an endpoint would
   violate Rule 5 (backend contracts are the source of truth); the
   9.4/9.6 state layers branch on the blocked code instead.

2. **The abstraction token lives with the abstraction.**
   `PAYMENT_PROVIDER` is declared in `integrations/payment-provider.ts`
   (not beside the adapter): pages and state inject the token typed as
   `PaymentProvider` and never import Stripe shapes. The routes file —
   composition, not consumption — binds it via `useClass:
   StripePaymentProvider` with environment-sourced script URL and
   publishable key. No `@stripe/*` npm dependency exists; the SDK
   loads at runtime through the injectable `STRIPE_JS_LOADER` seam.

3. **Single-shot verification, never polling loops.**
   `PaymentState.refreshStatus` issues exactly one explicit status read
   per call (page entry for success/pending/unknown claims, manual
   check buttons). Transport loss records an error and HOLDS the stage
   — loss is not failure — and unknown outcomes hold `processing` with
   the submit lock on until backend truth resolves them.

4. **Backend verdicts override provider claims, including out of
   terminal stages.** `resolveBackendStatus` maps `Succeeded`/`Failed`/
   `Cancelled` onto the lifecycle even from `succeeded`
   (`pending → cancelled`, `succeeded → failed`, `succeeded →
   cancelled` edges added in 9.8): client-side confirmation is never
   final proof, and the override is test-pinned.

5. **Recovery is a decision table, not scattered branches.**
   `classifyPaymentFailure` (init vs. confirmation) and
   `paymentRecoveryFor` (retry-initialization vs. check-status vs.
   none) in feature models drive the retry affordance gating; pages
   never branch on message text.

6. **Order display reads stay in payments data-access.**
   The payment UI summary reads `GET /orders/{id}` through
   `PaymentApiService.getOrderDetails` into a best-effort display
   slot (failures hide the summary without touching the payment flow)
   — the same cross-module read precedent as product-details over
   cart endpoints. No order orchestration, polling, or history (Phase
   10 owns those).

## Consequences

- The full 9.x machine (init → provider setup → confirm → verify →
  retry) is implemented, localized in five cultures, and covered from
  unit to E2E — with every backend gap honest: blocked paths error
  instead of hallucinating, and the E2E gated journeys document their
  exact enable condition.
- `PaymentState` stays route-scoped signals (no store library was ever
  justified); `clientSecret` never leaves memory; SSR executes zero
  provider code (five `Phase 9.11` audit checks pin this permanently).
- Phase 10 inherits: the `/payment/:orderId` + `/result` lazy boundary,
  the `Payment`/`PaymentStatus` contract mirrors, and the order-handoff
  seam (`Continue to payment` from checkout success).
