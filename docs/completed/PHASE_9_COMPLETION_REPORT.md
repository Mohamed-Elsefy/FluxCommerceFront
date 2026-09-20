# Phase 9 — Payments: Completion Report

Status: **Complete** — 2026-09-19.

Phase 9 turns the Phase 8 created order into a complete payment
experience: from `/checkout` success the customer follows the
`Continue to payment` seam to `/payment/:orderId`, reviews the
backend-issued order summary, initializes through feature state,
confirms through the isolated Stripe provider boundary, and lands on
the backend-verified `/payment/:orderId/result` outcome hub — localized
in five cultures, RTL-safe, responsive, accessible, and covered from
unit to E2E. All thirteen sub-phases (9.1–9.13) are done in dependency
order, and the project is ready for **Phase 10 — Orders & Customer
Account**.

Related references: `docs/PROJECT_CONTEXT.md` (§30),
`docs/ARCHITECTURE.md` (§§5, 9, 20),
`docs/phases/PHASE_9_PAYMENTS.md`,
`docs/adr/021-payment-contract-architecture-audit.md`,
`docs/adr/022-payment-feature-architecture.md`.

The final boundary holds: Angular owns the payment experience and
provider integration; the backend owns payment truth and business
orchestration. No order saga, inventory compensation, payment
verification, webhook handling, `HttpClient` use, Stripe SDK surface,
or secret/identifier leaks exist outside their owning layers
(E2E- and audit-pinned), and every price, total, and status comes from
the backend contract (the suites fail if the UI ever computes or
invents them).

---

## 1. Sub-phase summary

```text
9.1  Payment Contract & Architecture Audit
     Backend payment surface audited (`GET /api/payments/{id}` is the
     ONLY SPA-callable endpoint; the webhook is Stripe→API only; NO
     client-secret HTTP path exists — the blocker). Frontend
     `Order`/`Payment`/`PaymentAttempt`/`PaymentStatus` models as
     aliases over `@flux/models` (no drift), responsibility tables
     (frontend UX vs. backend truth, disjoint by construction),
     memory-only secret pins (`docs/adr/021`).

9.2  Payment Feature Foundation
     `features/payments/` slice (pages, components, data-access,
     state, models, integrations, `payments.routes.ts`), auth-guarded
     lazy boundary serving `/payment/:orderId` and
     `/payment/:orderId/result`, skeleton shells, SSR `RenderMode.Server`
     entries, reserved-folder `.gitkeep` discipline.

9.3  Payment API & Data Access
     Thin `PaymentApiService` over `ApiClient` (canonical templates,
     `pathParams`, envelope passthrough, `AbortSignal` forwarding).
     `getPaymentStatus` executes for real; `initializePayment`/
     `confirmPayment` expose the typed shapes and short-circuit with
     `PaymentContractBlocked` (zero HTTP, zero identifier echo) until
     the backend lands their paths — never a fabricated endpoint.

9.4  Payment State & Lifecycle
     Route-provided `PaymentState` (local Signals, never global, no
     store library): `idle → initializing → ready → processing →
     succeeded`, plus `failed`/`pending`/`cancelled`, a fail-closed
     transition table, guarded boolean actions, API/UI state
     separation, and the structural `Initialized ≠ Succeeded` rule.

9.5  Stripe.js / Elements Integration Boundary
     `PaymentProvider` abstraction (five lifecycle methods) plus
     `StripePaymentProvider` behind it: no `@stripe/*` dependency
     (runtime script injection via the `STRIPE_JS_LOADER` seam),
     script URL + publishable key from app environments (never
     hard-coded), `PLATFORM_ID` guards on every browser touch, and a
     pure intent→outcome mapping table.

9.6  Payment Initialization
     `PaymentState.initializePayment` (gate + service + markReady/
     markFailed), page orchestration (browser-guarded entry, single
     in-flight attempt, provider setup once per intent, safe retry),
     route-level provider + token provisioning, `RenderMode.Server`
     unchanged.

9.7  Payment Confirmation
     `PaymentState.confirmPayment` (ready-gate submit lock, provider
     call, six-outcome mapping with `confirmationOutcome` recording;
     `unknown` holds `processing` — never a blind retry), page submit
     wiring, and the `PAYMENT_PROVIDER` token move into the
     abstraction file.

9.8  Payment Result & Status Handling
     Single-shot `refreshStatus` with backend-truth overrides
     (`pending → cancelled`, `succeeded → failed/cancelled` edges —
     provider claims are never final proof), outcome hub result page
     (success/failure/cancelled/pending/unknown blocks + neutral
     fallback), and payment→result navigation for resolved, waiting,
     and outstanding-unknown stages.

9.9  Failure, Pending, Cancellation & Retry
     Pure recovery decision tables (`classifyPaymentFailure`,
     `paymentRecoveryFor`), retry-affordance gating (no dead-end
     buttons), unknown routing + verification-only block, context
     preservation across failures — no polling loops, ever.

9.10 Payment UI & Checkout Integration
     `payment.*` i18n namespace in all five cultures, feature error
     resolver (decline passthrough, localized codes, base fallback —
     technical internals never render), `getOrderDetails` display read
     with best-effort state slot, `PaymentOrderSummaryComponent`
     (backend-issued display only), localized pages with titles and
     submit locks, and the checkout `Continue to payment` seam.

9.11 Security, SSR & Sensitive Data Handling
     Evidence audit (zero secret keys/cards/console/storage/URLs in
     shipped code), five permanent `Phase 9.11` architecture checks,
     comment-honesty fixes, and regression tests (setup idempotency,
     server DOM secret sweeps).

9.12 Testing & E2E Verification
     Unit gap fills (processing submit lock, failed-block summary)
     plus `e2e/payments.spec.ts`: executable entry/summary/failure/
     retry/fallback/security suites green; the five backend-gated
     journeys ship skipped with exact enable conditions; checkout E2E
     regression 12/12.

9.13 Final Verification & Documentation (this sub-phase)
     Architectural audit re-run, this report, `docs/adr/022`,
     `PROJECT_CONTEXT.md` §30 + `ARCHITECTURE.md` §20 as-built sync.
```

---

## 2. Contract notes

One mid-phase backend gap shaped the whole implementation and was
never papered over: **no client-secret HTTP endpoint exists**, so
initialization and provider confirmation cannot execute end to end
against the current backend. The feature is complete and fully tested
around that gap — blocked operations error instead of hallucinating
(`PaymentContractBlocked`, test-pinned at service, state, page, and
E2E levels), the E2E gated journeys name their enable condition, and
the day the backend lands the path only the service bodies change
(state machines, provider boundary, pages, and tests already drive
the success shapes through mocks). Money discipline held throughout:
no `unitPrice × quantity`, no totals math, no fabricated order
numbers — display echoes backend issues verbatim or renders nothing.

---

## 3. Verification results (2026-09-19)

```text
npm run lint                  Prettier + ESLint — 0 errors
npm run typecheck             all app/lib/spec targets — 0 errors
npm run build:storefront      SSR build (12 routes prerendered) — success
npm run build:admin           CSR build — success
npm run test:unit             storefront 1069 + admin 20 + libs 390
                              = 1479 passed, 0 failed
npm run test:e2e              payments-chromium 4 passed / 5 skipped (gated);
                              checkout-chromium 12/12 passed (regression)
verify-architecture.mjs       102/102 checks passed (97 baseline + 5× 9.11)
```

The reachable journey (Authenticated Customer → Cart → Checkout →
Order Created → Continue to payment → Order Summary → Initialization
Failure → Localized Error → Safe Retry → Verified Result Fallback)
passes end to end, including exact order-call assertion (single POST,
no duplicate orders on payment retry), backend-totals display
assertion, zero-verification-calls assertion on the fallback route,
and the no-Stripe/no-iframe/no-secret security sweep.

---

## 4. Key architectural decisions

- Blocked beats fabricated: operations without a backend path
  short-circuit with a normalized, branchable error instead of
  inventing traffic — the state machines treat the blocker as a
  first-class outcome, and E2E pins it.
- Tokens, not imports: `PAYMENT_PROVIDER` lives with the abstraction
  so consumers can never reach Stripe shapes; the routes file composes
  (`useClass` + environment tokens) without consuming.
- Verification is single-shot and overriding: one explicit read per
  trigger, backend verdicts win even out of terminal stages, and
  transport loss is recorded — never mistaken for payment failure.
- Unknown means locked: sent-but-unread holds `processing` with the
  submit lock on and offers verification only; the unknown block
  carries no retry surface by construction.
- Recovery is a table: failure-kind and recovery-action classifiers
  keep every retry deliberate, state-aware, and duplicate-safe, with
  order context preserved across all of them.
- Localization is a feature namespace: `payment.*` in five cultures
  with parity tests, and a code-first error resolver whose leakage
  sweeps prove secrets and internals never render.
- Tests caught real issues: the auto-navigation consequence of
  terminal failures (E2E found it — result blocks gained the order
  summary), the floating-promise flush gap in specs (`settleAsync`),
  TestBed provider gaps for new injections, and the strict-mode
  heading collision — none waived.

---

## 5. Known limitations

- `test:e2e` needs the dev servers + Playwright browsers; payments
  transport is mocked with backend-faithful semantics because the
  intent endpoint does not exist yet. The five gated journeys
  (`describe.skip` with reason + enable condition) activate once
  `initializePayment` executes HTTP — no test-architecture changes
  needed, only unskipping and pointing at the landed contract.
- The Stripe publishable key in app environments is the shared
  public test key; replace per deployment (publishable keys are
  public by design — never the secret key).
- Payment state is route-scoped: leaving the payments subtree drops
  the flow by design (deep links render the neutral fallback, never
  fabricated outcomes).
- The vitest worker pool occasionally times out under load on
  first runs (documented in `vitest-base.config.ts`); clean
  retries pass.

---

## 6. Deferred work (explicit non-goals)

```text
Phase 10 — Orders & Customer Account: order polling, orders
           list/details, order status reads, profile/account
           experience (payments consumes `GET /orders/{id}` for
           display only — orchestration stays deferred)
Phase 14 — Admin Orders & Payments: payment status/details admin
           surfaces (storefront-only implementation here)
```

---

## 7. Documentation changes in this phase

```text
docs/completed/PHASE_9_COMPLETION_REPORT.md   created (this file)
docs/PROJECT_CONTEXT.md                       §30 marked Complete
docs/ARCHITECTURE.md                          §20 as-built sync
docs/adr/021-payment-contract-                 created (9.1 audit)
  architecture-audit.md
docs/adr/022-payment-feature-architecture.md  created (9.3–9.12
                                              decisions)
e2e/payments.spec.ts + payments-chromium      created (4 passed /
                                              5 gated-skipped)
apps/storefront/.../features/payments/        built across 9.2–9.10
apps/storefront/.../features/checkout/        seam link + key (9.10)
libs/models/.../payment-contract.ts           created (9.1 audit)
scripts/verify-architecture.mjs               +5 Phase 9.11 checks
                                              (102/102)
```
