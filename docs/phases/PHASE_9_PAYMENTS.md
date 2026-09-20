# Phase 9 — Payments

## Objective

Implement the complete payment experience in the Angular Storefront while preserving the established frontend architecture and keeping payment orchestration and business rules in the Backend.

The target flow is:

```text
Checkout
   ↓
Created Order
   ↓
Payment Initialization
   ↓
Client Secret
   ↓
Stripe Elements
   ↓
Payment Confirmation
   ↓
Payment Result
   ├── Success
   ├── Pending
   ├── Failed
   └── Cancelled
```

Angular is responsible for payment UX, provider integration, feature state, navigation, loading/error handling, and payment result presentation.

The Backend remains responsible for payment creation/state, Stripe secret handling, verification, webhooks, idempotency, order transitions, inventory coordination, Saga, and compensation.

---

## 9.1 — Payment Contract & Architecture Audit

### Goal

Establish the exact Frontend/Backend payment boundary before implementation.

### Tasks

- Review the existing Backend payment endpoints.
- Review payment request/response contracts.
- Identify the payment initialization contract.
- Identify the payment status contract.
- Identify the payment confirmation flow.
- Identify the relationship between:
  - Order
  - Payment
  - PaymentAttempt
  - PaymentStatus
- Determine which identifiers are required:
  - `orderId`
  - `paymentId`
  - idempotency key
  - client secret
  - payment reference
- Identify the payment states exposed to the Frontend.
- Document the Frontend/Backend responsibility boundary.

### Frontend Responsibilities

```text
Payment UX
Payment Integration
Payment State
Payment Result
```

### Backend Responsibilities

```text
Payment Creation
Payment Verification
Webhook Processing
Order State
Inventory
Saga
Compensation
Idempotency
```

### Completion Criteria

- Payment contracts are clearly identified.
- No Frontend business logic duplicates Backend payment orchestration.
- Required DTOs and API operations are known before implementation.

---

## 9.2 — Payment Feature Foundation

### Goal

Create the Payment feature structure according to the existing project architecture.

### Tasks

Create or finalize the Payment feature structure:

```text
payments/
├── pages/
├── components/
├── data-access/
├── state/
├── models/
├── integrations/
└── payments.routes.ts
```

### Responsibilities

#### Pages

- Payment page.
- Payment result page.

#### Components

- Payment form.
- Payment status.
- Payment error.
- Payment loading states.

#### Data Access

- Payment API service.

#### State

- Feature-local Signals.

#### Integrations

- Payment provider abstraction.
- Stripe implementation.

### Rules

- Do not introduce a global payment store.
- Do not place payment business logic inside components.
- Do not make direct `HttpClient` calls from UI components.
- Use the existing `ApiClient`.
- Preserve the existing feature/data-access/UI boundaries.

### Completion Criteria

- Payment feature has a clean architectural boundary.
- Routing and feature structure are ready for implementation.
- Payment-specific state remains feature-local.

---

## 9.3 — Payment API & Data Access

### Goal

Build the Frontend data-access layer for the existing Backend payment APIs.

### Tasks

- Create `PaymentApiService` or the project-equivalent service.
- Implement the required payment API operations.
- Use the existing `ApiClient`.
- Define typed request/response models.
- Map API failures to the existing `ApiError` model.
- Support request cancellation where appropriate.
- Avoid Stripe-specific implementation details in the API service.
- Avoid logging sensitive payment information.

### Expected Flow

```text
Payment UI
    ↓
Payment State
    ↓
Payment API Service
    ↓
ApiClient
    ↓
Backend
```

### Completion Criteria

- Payment API calls are centralized.
- API contracts are strongly typed.
- Existing API error handling is reused.
- UI components contain no direct API communication.

---

## 9.4 — Payment State & Lifecycle

### Goal

Model the payment lifecycle using feature-local Signals.

### Core States

```text
Idle
  ↓
Initializing
  ↓
Ready
  ↓
Processing
  ↓
Succeeded
```

Alternative transitions:

```text
Initializing → Failed
Ready → Failed
Processing → Failed
Processing → Pending
Processing → Cancelled
Pending → Succeeded
Pending → Failed
```

### Tasks

- Define the payment state model.
- Create feature-local Signals.
- Define valid state transitions.
- Track required payment context:
  - `orderId`
  - `paymentId`
  - `clientSecret`
  - payment status
  - error
  - loading/processing state
- Prevent invalid or conflicting state transitions.
- Separate API state from UI state where appropriate.

### Important Rule

Payment initialization success must not be treated as payment success.

```text
Payment Initialized ≠ Payment Succeeded
```

### Completion Criteria

- All supported payment states are represented.
- State transitions are explicit and testable.
- Payment state is not unnecessarily promoted to global state.

---

## 9.5 — Stripe.js / Elements Integration Boundary

### Goal

Integrate Stripe without spreading provider-specific logic throughout the Payment feature.

### Tasks

Create a payment provider abstraction compatible with the project architecture, for example:

```text
PaymentProvider
```

with a concrete implementation such as:

```text
StripePaymentProvider
```

### Responsibilities

The provider boundary should encapsulate operations such as:

```text
Initialize Provider
Create Elements
Mount Payment UI
Confirm Payment
Return Provider Result
```

### Target Architecture

```text
Payment Component
       ↓
Payment State
       ↓
Payment Provider
       ↓
Stripe
```

### Rules

- Keep Stripe-specific details inside the integration boundary.
- Do not couple payment state directly to Stripe SDK internals.
- Keep the design extensible for another provider in the future.
- Keep browser-only provider initialization out of SSR execution.

### Completion Criteria

- Stripe integration is isolated behind a clear boundary.
- The Payment feature does not depend directly on Stripe implementation details.

---

## 9.6 — Payment Initialization

### Goal

Connect the Checkout flow to Backend payment initialization.

### Flow

```text
Checkout
   ↓
Order Created
   ↓
Payment Page
   ↓
Initialize Payment
   ↓
Backend
   ↓
Client Secret
   ↓
Payment Ready
```

### Tasks

- Receive and validate the required `orderId`.
- Load the required payment context.
- Call the payment initialization API.
- Handle loading state.
- Store the `clientSecret` in memory only.
- Initialize Stripe Elements after receiving the required data.
- Prevent duplicate initialization.
- Handle initialization failures.
- Support safe initialization retry when allowed by the Backend contract.

### Sensitive Data Rules

The `clientSecret` must not be stored in:

- `localStorage`
- `sessionStorage`
- Persistent global state
- URLs
- Logs
- Telemetry

### Completion Criteria

- Payment initialization works from the existing Checkout flow.
- Stripe Elements is initialized only after the required payment data is available.
- Sensitive runtime payment data remains in memory.

---

## 9.7 — Payment Confirmation

### Goal

Implement payment confirmation through the Stripe integration boundary.

### Flow

```text
Payment Ready
     ↓
Customer Submits Payment
     ↓
Processing
     ↓
Stripe Confirmation
     ↓
Payment Result
```

### Tasks

- Handle payment form submission.
- Prevent duplicate submissions.
- Transition state to `Processing`.
- Call the provider confirmation operation.
- Map provider results into application state.
- Handle:
  - Immediate success
  - Failure
  - Cancellation
  - Additional customer action
  - Pending/unknown results

### Critical Boundary

Angular must not implement Backend payment orchestration such as:

```text
Payment Succeeded
    ↓
Confirm Order
    ↓
Update Inventory
```

or:

```text
Payment Failed
    ↓
Release Inventory
```

These remain Backend responsibilities.

### Completion Criteria

- Payment confirmation is integrated with the provider.
- Duplicate submission is prevented.
- Provider results are translated into application-level payment states.
- Backend business workflows remain untouched.

---

## 9.8 — Payment Result & Status Handling

### Goal

Provide explicit handling for every relevant payment outcome.

### Success

```text
Payment Succeeded
        ↓
Verify/Read Backend State
        ↓
Order Result
```

### Failure

```text
Payment Failed
      ↓
Display Failure
      ↓
Retry / Return to Checkout
```

### Pending

```text
Payment Pending
      ↓
Display Pending State
      ↓
Retrieve Backend Status When Appropriate
```

### Cancelled

```text
Payment Cancelled
      ↓
Retry / Return
```

### Rules

- Do not treat a successful client-side action as proof that the Order is finalized.
- Backend remains the authoritative source for final Payment and Order state.
- Handle provider and Backend states independently when necessary.

### Completion Criteria

- Success, failure, pending, and cancellation have explicit UI/state handling.
- Final Order state is derived from the authoritative Backend state where required.

---

## 9.9 — Failure, Pending, Cancellation & Retry

### Goal

Implement safe and state-aware handling for payment problems.

### Initialization Failure

```text
Order Exists
     ↓
Payment Initialization Failed
     ↓
Retry Initialization
```

### Confirmation Failure

```text
Payment Initialized
     ↓
Confirmation Failed
     ↓
Display Failure
     ↓
Safe Retry
```

### Pending

```text
Payment Is Not Final
     ↓
Display Pending
     ↓
Check Backend Status When Appropriate
```

### Unknown Result

For example:

```text
Payment Request Sent
       ↓
Network Failure
       ↓
Unknown Whether Payment Was Processed
```

Do not blindly retry.

Instead:

```text
Check Backend Payment Status
       ↓
Determine Current State
```

### Retry Rules

Retries must be:

- Deliberate.
- State-aware.
- Idempotent where supported by the Backend.
- Protected against duplicate payment attempts.
- Avoided when the previous operation may have succeeded but the result is unknown.

### Completion Criteria

- Failure categories are distinguished.
- Pending is a first-class state.
- Unknown outcomes do not trigger unsafe blind retries.
- Retry UX reflects the actual payment state.

---

## 9.10 — Payment UI & Checkout Integration

### Goal

Integrate the Payment experience into the Storefront UX.

### Routes

Use the project's established routing conventions. The resulting flow may follow a structure such as:

```text
/checkout
/payment/:orderId
/payment/:orderId/result
```

### UI States

The UI must clearly represent:

```text
Loading Payment
Payment Form
Processing Payment
Payment Successful
Payment Failed
Payment Pending
Payment Cancelled
```

### UX Requirements

- Prevent duplicate submission.
- Disable appropriate controls while processing.
- Display localized user-facing errors.
- Preserve required order context.
- Provide safe retry actions.
- Provide appropriate navigation options.
- Avoid exposing technical payment details.
- Follow the existing design system and UI patterns.

### Completion Criteria

- Checkout transitions cleanly into Payment.
- Payment states are visually clear.
- Payment Result UX is consistent with the existing Storefront.

---

## 9.11 — Security, SSR & Sensitive Data Handling

### Goal

Ensure payment integration is secure and compatible with Storefront SSR/Hydration.

### SSR Rules

Stripe/browser-specific code must not execute during SSR.

```text
SSR
 ↓
No Stripe Elements
No Browser-only APIs
```

Browser execution:

```text
Hydration
 ↓
Initialize Stripe
 ↓
Mount Elements
```

### Sensitive Data Rules

Never place the following in Frontend configuration or persistent storage:

```text
Stripe Secret Key
Payment Secrets
Raw Card Data
Sensitive Payment Payloads
```

### Additional Checks

- No Stripe secret key in frontend environment configuration.
- No sensitive payment values in URLs.
- No sensitive payment values in logs.
- No sensitive payment values in telemetry.
- Follow the provider's secure integration model.
- Verify that SSR and hydration do not create duplicate payment initialization or Elements instances.

### Completion Criteria

- Payment integration is SSR-safe.
- Sensitive data is handled only at runtime and within the appropriate boundary.
- No secret credentials are exposed to the browser.

---

## 9.12 — Testing & E2E Verification

### Goal

Verify payment behavior at unit, integration, provider-adapter, component, and E2E levels.

### Unit Tests

Test:

- Initial state.
- Initialization success.
- Initialization failure.
- Confirmation success.
- Confirmation failure.
- Pending state.
- Cancellation.
- Retry.
- Unknown result.
- Invalid state transitions.
- Error mapping.
- Sensitive-data handling.

### API Tests

Mock:

```text
Initialize Payment
Get Payment Status
Payment Errors
```

### Stripe Provider Tests

Mock the Stripe SDK and verify:

```text
Elements Initialization
Payment Confirmation
Success
Failure
Cancellation
Additional Action
```

### Component Tests

Test:

- Loading UI.
- Payment form.
- Disabled submit.
- Processing state.
- Error UI.
- Success UI.
- Pending UI.
- Retry UI.
- Cancellation UI.

### E2E Scenarios

#### Successful Payment

```text
Checkout
 → Order Created
 → Payment
 → Success
```

#### Failed Payment

```text
Checkout
 → Order Created
 → Payment
 → Failure
 → Retry
```

#### Pending Payment

```text
Checkout
 → Order Created
 → Payment
 → Pending
```

#### Cancelled Payment

```text
Checkout
 → Order Created
 → Payment
 → Cancel
```

#### Unknown Result

```text
Checkout
 → Order Created
 → Payment
 → Network/Unknown Result
 → Backend Status Check
```

### Completion Criteria

- Payment state transitions are covered.
- API behavior is covered.
- Stripe integration is isolated and testable.
- Critical payment journeys are covered by E2E tests.

---

## 9.13 — Final Verification & Documentation

### Goal

Close Phase 9 without breaking the existing application architecture or previous phases.

### Verification

Run and verify:

- Angular build.
- Storefront SSR build.
- Unit tests.
- Integration/API tests.
- E2E tests.
- Lint.
- Type checking.
- Existing regression tests.

### Architecture Verification

The final Payment flow should preserve:

```text
UI
 ↓
Feature State
 ↓
Data Access
 ↓
ApiClient
 ↓
Backend
```

And provider integration should remain isolated:

```text
Payment Feature
      ↓
Payment Provider Abstraction
      ↓
Stripe
```

Avoid:

```text
Component
   ↓
HttpClient
```

and:

```text
Angular
   ↓
Order Saga
Inventory Compensation
Payment Verification
```

### Documentation

Update the appropriate project documentation:

- `PROJECT_CONTEXT.md`
- `ARCHITECTURE.md`
- Phase completion documentation
- Payment-related ADRs when an architectural decision requires explicit documentation

### Completion Criteria

Phase 9 is complete when:

- The Storefront can initialize a payment for a created Order.
- Stripe Elements is integrated behind a provider boundary.
- Payment confirmation works through the intended flow.
- Success, failure, pending, cancellation, and retry states are handled.
- Unknown payment outcomes are handled safely.
- SSR/Hydration constraints are respected.
- Sensitive payment data is not persisted or exposed.
- Payment business orchestration remains in the Backend.
- Tests and regression checks pass.
- Project documentation reflects the completed implementation.

---

# Phase 9 Completion Flow

```text
┌─────────────┐
│   Checkout  │
└──────┬──────┘
       ↓
┌─────────────┐
│ Order Created│
└──────┬──────┘
       ↓
┌─────────────────────┐
│ Payment Initialization│
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│     Client Secret   │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│   Stripe Elements   │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ Payment Confirmation │
└──────────┬──────────┘
           ↓
      ┌────┴─────┬──────────┬────────────┐
      ↓          ↓          ↓            ↓
   Success     Pending    Failed      Cancelled
      ↓          ↓          ↓            ↓
      └──────────┴──────────┴────────────┘
                         ↓
                  Backend State
                         ↓
                    Order Result
```

## Phase 9 Architectural Principle

> **Angular owns the payment experience and provider integration; the Backend owns payment truth and business orchestration.**
