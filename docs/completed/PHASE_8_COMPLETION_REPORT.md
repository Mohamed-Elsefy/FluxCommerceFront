# Phase 8 — Checkout: Completion Report

Status: **Complete** — 2026-09-17.

Phase 8 turns the Phase 7 cart into a complete customer checkout:
from `/cart` the authenticated customer follows the navigation
boundary to `/checkout`, reviews the backend-facts-only order
summary, enters shipping and billing addresses in typed Reactive
Forms, submits once against a snapshotted cart, and lands on the
created order — localized in five cultures, RTL-safe, responsive,
accessible, and covered from unit to E2E. All ten sub-phases
(8.1–8.10) are done in dependency order, and the project is ready
for **Phase 9 — Payments**.

Related references: `docs/PROJECT_CONTEXT.md` (§29),
`docs/ARCHITECTURE.md` (§§5, 9, 20),
`docs/phases/PHASE_8_CHECKOUT.md`.

The final boundary holds: checkout presents and submits, never
orchestrates — no payment, Stripe, order-polling, inventory, or saga
logic exists in the Phase 8 touchpoints (E2E-pinned), and every
price, total, and consolidation comes from the backend contract
(the suite fails if the UI ever computes them).

---

## 1. Sub-phase summary

```text
8.1  Architecture & Contract
     Feature-owned `CreateOrderRequest`/`CreateOrderResponse` aliases
     over `@flux/models` (no drift), customer/shipping view types,
     `CheckoutOrderSummary` with null-until-backend money slots (no
     local price math, ever), `Idempotency-Key` bounds, pure
     `CheckoutRequest` mapper, status-first error-code unions, and
     the cart/form/submission boundary shapes with empty-cart and
     cart-changed initialization rules.

8.2  Feature & Data Access
     Thin `CheckoutApiService` over `ApiClient` (`POST
     /orders/checkout` from `ORDERS_ENDPOINTS`, key as request
     context — never in the body, `AbortSignal` passthrough, no
     envelope unwrapping, no error remapping), `newIdempotencyKey`
     mint, and the auth-guarded `checkoutRoutes` lazy boundary.

8.3  Feature State
     Route-provided `CheckoutState` (local Signals, never global, no
     NgRx): `initial → loading → ready → submitting → success |
     failure` derived workflow, snapshot-only cart consumption
     (`cartId`/`version`/line count — never lines or prices),
     separate form slot, pessimistic submit locks, staleness guard.

8.4  Customer & Shipping Information
     Typed `FormBuilder` groups (shipping + billing + same-flag),
     contract-mirroring validators (required, length caps, 2-upper
     country pattern), `CheckoutFieldErrors` (control-events +
     `markForCheck` liveness under OnPush), `CheckoutAddressForm`
     (reused per section, labelled inputs, `aria-invalid`/
     `aria-describedby`), emitting `CheckoutFormComponent`, and the
     `checkout` i18n namespace in all five cultures. Contract-honest
     omissions, test-pinned: no email/phone/method controls (the
     wire carries none).

8.5  Order Summary
     Presentational `OrderSummaryComponent` plus the pure
     `toOrderSummaryView` projector: backend unit snapshots and
     quantities as separate facts (no line totals — the contract
     carries none), money rows verbatim-or-pending-note, empty
     state, input-driven dynamic sync for the 8.6 page.

8.6  Client Validation & Create Order
     `CheckoutPage` orchestration: session-lifecycle cart
     establishment, signal-effect initialization, validated-only
     submit (`setFormData` + `submitOrder({ currentCart })`),
     frozen form while submitting, success confirmation exposing
     the created `orderId` as the Phase 9 handoff (no navigation,
     no payment), cart lifecycle seams provided one-way at the
     route (product-details pattern).

8.7  Failure Handling & Recovery
     Status-first `checkoutRecoveryFor` (`retry`/`edit`/`cart`),
     post-failure submit lock until explicitly cleared, recorded
     keys with same-key `retrySubmission` (replay-or-create-once),
     cart-gone re-validation guiding back to Cart, sanitized
     messages only (`resolveApiErrorMessage` — raw details never
     render, leak-marker tested).

8.8  Localization, RTL, Responsive & Accessibility
     `role="form"` landmark, `alert`/`status` roles, labelled
     controls in DOM Tab order (no positive tabindex),
     failure-banner focus management (`afterRenderEffect` — a plain
     effect fires before the banner exists), direction-invariance
     suite, injected-stylesheet logical-properties audit, canonical
     breakpoints, `raw-imports.d.ts` for `?raw` spec types.

8.9  Unit & Component Testing
     Gap-fill pass only (no production changes): form-state
     transitions, fresh-key-after-clear, idle-clear safety,
     snapshot preservation, per-class failure passthrough (400 map,
     status-0, 404), DOM-level pattern/length messages,
     multi-line summary, mid-checkout session expiry. 188
     unit/component tests across 14 checkout suites.

8.10 Checkout E2E & Integration Verification (this sub-phase)
     12-test Playwright suite with a stateful mock backend
     (primary cart-to-order journey with payload/header/result
     assertions plus no-payment/no-totals boundary pins; empty
     cart; invalid form; 400/409/404/401/abort verdicts with
     fresh-key, same-key, and back-to-Cart recoveries;
     in-flight locking; cart-modification tracking; anonymous
     redirect; refresh recovery) and the `checkout-chromium`
     project.
```

---

## 2. Contract notes

No mid-phase backend contract change was required: the
`CheckoutRequest`/`CheckoutResponse` shapes from
`docs/frontend-contract/` covered the whole phase. Two
contract-honest gaps were documented and pinned instead of
fabricated — no customer object beyond the address
`recipientName`, and no shipping-method field — so the form has
no email/phone/method controls and the summary has no method
section. Money discipline held throughout: the cart exposes no
totals object, checkout returns none, and every slot stays `null`
until a backend source provides it.

---

## 3. Verification results (2026-09-17)

```text
npm run lint                  Prettier + ESLint — 0 errors
npm run typecheck             all app/lib/spec targets — 0 errors
npm run build:storefront      SSR build — success
npm run build:admin           CSR build — success
npm run test:unit             storefront 872 + admin 20 + libs 352
                              = 1244 passed, 0 failed
npm run test:e2e              checkout-chromium 12/12 passed
verify-architecture.mjs       97/97 checks passed
```

The primary journey (Authenticated Customer → Cart → Checkout →
Customer/Shipping entry → Summary Review → Submit → Create Order
→ Order Created) passes end to end, including exact wire-body
assertion (`cartId` + verbatim addresses with `line2: null`),
`Idempotency-Key` header assertion, single-POST assertion, and
the `59.98` no-computation pin (2 × 29.99 never multiplied).

---

## 4. Key architectural decisions

- Aliases, never re-declarations: `@flux/models` stays the single
  declaration site for every wire shape; the feature owns only
  view types, mappers, and guards — contract drift is
  structurally impossible.
- Snapshots, never stores: checkout keeps `cartId`/`version`/
  line count and re-projects the summary live from cart data, so
  the review tracks the backend with no second cart and no cycle.
- Locks compose: in-flight, post-success, and post-failure locks
  at the state level; form freeze at the component level; the
  `Idempotency-Key` header as the server-side backstop — a failed
  request never silently re-fires, and transport retries reuse
  the recorded key.
- OnPush correctness is engineered, not assumed: error views
  subscribe to control events (`markForCheck`), and failure focus
  runs in `afterRenderEffect` (a plain effect fires before the
  banner exists) — both caught by tests, not by inspection.
- Effects track one concern each with `untracked` discipline;
  recovery branches (`retry`/`edit`/`cart`) keep every re-attempt
  explicit and every backend detail sanitized.
- Tests caught real issues: `addInitScript` closures not
  surviving serialization (anonymous sessions in E2E), `exact:
true` against interpolated strings, `formatCurrency` rendering
  `$29.99`, `markInitializedAnonymous` being startup-only, and
  the focus-ordering bug above — none waived.

---

## 5. Known limitations

- `test:e2e` needs the dev servers + Playwright browsers; the
  checkout transport is mocked with backend-faithful semantics
  because no live backend runs here. Handlers isolate per suite
  for a future live switch (same convention as `cart.spec.ts`).
- Form state is route-scoped: a page refresh resets typed input
  by design (pinned — summary re-projects, no phantom order).
- Direct navigation to `/checkout` server-renders the auth
  redirect; the supported entry is client-side navigation after
  session restore (login preserves `returnUrl`).
- The vitest worker pool occasionally times out under load on
  first runs (documented in `vitest-base.config.ts`); clean
  retries pass.

---

## 6. Deferred work (explicit non-goals)

```text
Phase 9  — Payments: Stripe Elements, client secrets, payment
           intents/webhooks UX, payment status flows
Phase 10 — Orders & Account: order polling, orders list/details,
           order status reads, profile/account experience
```

---

## 7. Documentation changes in this phase

```text
docs/completed/PHASE_8_COMPLETION_REPORT.md   created (this file)
docs/PROJECT_CONTEXT.md                       §29 marked Complete
docs/ARCHITECTURE.md                          §§5/9/20 as-built sync
e2e/checkout.spec.ts + checkout-chromium      created (12 tests)
apps/storefront/.../features/checkout/        built across 8.1–8.8
                                              (188 unit/component
                                              tests, 14 suites)
```
