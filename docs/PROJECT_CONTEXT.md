# FluxCommerce — Project Context

## 1. Purpose

FluxCommerce is a production-oriented Enterprise E-Commerce & Order Management Platform.

The project is built to demonstrate real software engineering capabilities rather than simply collecting technologies. The system emphasizes:

- Strong modular boundaries
- Clean and maintainable architecture
- Reliable commerce workflows
- Concurrency handling
- Asynchronous processing
- Idempotency
- Failure recovery
- Observability
- Production-oriented testing

The backend is implemented as a **Modular Monolith**. The frontend is implemented as an Angular 22 multi-application workspace.

---

## 2. Backend Architecture

The backend uses:

- ASP.NET Core / .NET 10
- Modular Monolith architecture
- Clean Architecture principles
- DDD-oriented domain modeling
- Module-per-DbContext boundaries
- SQL Server
- Redis
- RabbitMQ
- JWT Authentication + Refresh Tokens
- Role-Based Authorization
- Transactional Outbox
- Idempotent Consumers
- Saga orchestration
- Compensation workflows
- Stripe Payments
- Structured Logging
- OpenTelemetry / distributed tracing
- Localization

Backend modules and capabilities include:

```text
Identity
Catalog
Cart
Orders
Inventory
Payments
Messaging / Outbox
Saga / Reliability
Localization
```

The backend owns business rules and business workflow orchestration.

The frontend must consume these capabilities through explicit API contracts and must not reproduce backend business orchestration.

---

## 3. Backend Completion Status

The backend has been completed through **Phase 12** and is considered ready for frontend development.

The implemented backend provides the foundation required by the Angular application, including:

- Identity and authorization
- Catalog and product data
- Guest and authenticated carts
- Guest → authenticated cart merge
- Orders and checkout
- Inventory and reservation
- Reliable messaging
- Idempotent consumers
- Order/Inventory Saga
- Stripe payments
- Payment Saga and compensation
- Reservation expiry orchestration
- Failure testing / reliability verification
- Localization
- Observability
- Architectural and integration testing

The existing backend documentation remains the source of truth for backend implementation details.

---

## 4. Backend Ownership Rules

Business ownership is explicit:

```text
Catalog
    → Product state

Cart
    → Temporary shopping state

Orders
    → Order state

Inventory
    → Stock and reservation state

Payments
    → Payment state
```

Modules must not directly access or modify another module's persistence state.

Cross-module communication uses approved contracts and integration events.

The frontend must preserve these boundaries.

---

# 5. Angular Frontend

The next major development stage is the Angular frontend.

The frontend uses **Angular 22** and consists of two applications in one workspace:

```text
FluxCommerce Angular Workspace
│
├── Storefront
│   └── Customer-facing application
│
├── Admin
│   └── Administration application
│
└── Shared Libraries
```

### Storefront

- Customer-facing
- SSR-enabled
- SEO-sensitive public pages
- Commerce experience

### Admin

- Internal dashboard
- CSR-oriented
- Authenticated
- No SEO requirement

---

# 6. Angular Architecture Reference

The detailed frontend architecture is defined in:

```text
docs/FLUXCOMMERCE_ANGULAR_ARCHITECTURE.md
```

That document is the architectural reference for frontend implementation.

Core structure:

```text
apps/
├── storefront/
└── admin/

libs/
├── api/
├── auth/
├── ui/
├── i18n/
├── theming/
├── models/
└── utils/
```

Business features remain feature-owned rather than being prematurely converted into shared libraries.

Example:

```text
features/catalog/
├── pages/
├── components/
├── data-access/
├── state/
├── models/
└── catalog.routes.ts
```

---

# 7. Angular Technology Baseline

The frontend uses:

- Angular 22
- Strict TypeScript
- Standalone components
- Standalone routing
- Signals
- SignalStore or NgRx only when justified by state complexity
- Angular HttpClient
- Functional HTTP interceptors
- Typed Reactive Forms
- SSR for Storefront
- CSR for Admin
- Vitest
- Playwright
- CSS custom properties
- Design tokens

The architecture prefers Angular platform capabilities and simple solutions before introducing additional libraries.

---

# 8. Frontend State Strategy

State is kept at the smallest appropriate scope.

### Local UI State

Use component Signals for temporary UI state.

### Feature State

Use Signals or feature stores for:

- Catalog filters
- Pagination
- Product selection
- Cart
- Checkout
- Orders

### Global State

Only genuinely global concerns:

```text
Authentication
Current User
Culture
Theme
Application Configuration
```

Do not place all server data into one global store.

Complex state may use SignalStore or NgRx when justified.

---

# 9. API Communication

Preferred flow:

```text
Component
    ↓
Feature Service / Store
    ↓
API Client
    ↓
HttpClient
    ↓
ASP.NET Core API
```

Components must not contain scattered business API calls.

The backend API contract is the source of truth.

The frontend should use strongly typed request/response contracts wherever possible.

---

# 10. Authentication

The frontend follows the backend JWT + refresh-token architecture.

Conceptually:

```text
Login
  ↓
Authenticated Session
  ↓
Access Token
  ↓
API Requests
  ↓
Access Token Expiration
  ↓
Refresh Token
  ↓
Retry
```

The frontend supports:

- Login
- Registration
- Logout
- Session restoration
- Token lifecycle
- 401 handling
- Authentication guards
- Role guards
- Current user state

Backend authorization remains authoritative.

---

# 11. Localization and RTL

Localization is a first-class frontend requirement.

The backend-supported cultures are:

```text
en
fr
de
es
ar
```

The frontend must support:

- Translation
- Language switching
- Culture persistence
- Backend culture synchronization
- Date formatting
- Number formatting
- Currency formatting
- Localized validation
- Localized API errors

RTL must be supported from the beginning.

CSS should prefer logical properties:

```css
margin-inline
padding-inline
inset-inline
border-inline
text-align: start
```

The UI must not be designed as LTR-only and fixed later.

---

# 12. Theming

The frontend uses:

- CSS custom properties
- Design tokens
- Centralized theme management
- `data-theme` on the root element

Initial themes:

```text
Light
Dark
```

Feature components consume theme tokens instead of hard-coded theme values.

---

# 13. Common Resource States

Loading, success, empty, and error states are treated as a shared frontend pattern.

```text
Idle
 ↓
Loading
 ↓
 ├── Success
 ├── Empty
 └── Error
```

Shared UI should provide consistent:

- Loading indicators
- Skeletons
- Empty states
- Error states
- Retry actions

Features remain responsible for deciding the appropriate state and behavior.

---

# 14. Pagination, Filtering and Sorting

Pagination is a reusable API/UI capability.

Conceptually:

```text
PagedResult<T>
├── items
├── pageNumber
├── pageSize
├── totalCount
├── totalPages
├── hasPrevious
└── hasNext
```

The exact structure follows the backend API contract.

Filtering and sorting are represented as typed feature state rather than duplicated query-string logic throughout components.

---

# 15. Commerce Flow

The primary Storefront flow is:

```text
Home
  ↓
Catalog
  ↓
Product Details
  ↓
Select Variant
  ↓
Add to Cart
  ↓
Cart
  ↓
Checkout
  ↓
Create Order
  ↓
Payment
  ↓
Payment Result
  ↓
Order
```

The frontend presents this workflow.

The backend remains responsible for:

- Order orchestration
- Inventory reservation
- Payment processing
- Saga transitions
- Compensation
- Webhooks
- Idempotency
- Failure recovery

---

# 16. Cart Requirements

The frontend must support:

```text
Guest Cart
    ↓
Login
    ↓
Cart Merge
    ↓
Authenticated Cart
```

Guest → authenticated cart merge is a mandatory tested scenario.

The frontend must not depend on Redis or other backend storage implementation details.

---

# 17. Product Experience

The Storefront Catalog/Product experience must support:

- Categories
- Search
- Filtering
- Sorting
- Pagination
- Product cards
- Product details
- Images
- Variants
- SKU
- Pricing
- Availability
- Specifications

Product presentation consumes backend contracts and does not make assumptions about persistence implementation.

---

# 18. Checkout and Payments

Checkout and Payments are separate frontend concerns.

Conceptual flow:

```text
Cart
  ↓
Checkout
  ↓
Create Order
  ↓
Payment Initialization
  ↓
Stripe
  ↓
Payment Result
  ↓
Order Status
```

The frontend handles the user-facing payment experience.

The backend remains responsible for payment verification, webhooks, order state transitions, inventory coordination, idempotency, Saga processing, and compensation.

---

# 19. Testing Strategy

Testing starts with the first implementation phase.

### Unit / Component

Use Vitest for:

- Services
- Stores
- State logic
- Utilities
- Validators
- Components
- Feature behavior

### E2E

Use Playwright for critical journeys.

Initial critical journeys:

```text
Authentication
Catalog browsing
Product selection
Add to cart
Guest → Login → Cart Merge
Checkout
Payment
Order creation
```

Admin E2E coverage is added as the Admin Portal is implemented.

As built in Phase 12: admin access control (anonymous, customer,
Admin/SuperAdmin, refresh, expiry, logout) and integrated journeys
(login flow, navigation, deep links, mobile drawer, localization,
RTL, theme) run green; see `docs/completed/PHASE_12_COMPLETION_REPORT.md`.

A feature is not complete merely because it works manually.

---

# 20. Frontend Implementation Roadmap

The Angular implementation follows a vertical-slice approach.

```text
Phase 0
Frontend Foundation + Testing

Phase 1
Core Infrastructure

Phase 2
Identity & Authentication

Phase 3
UI System + Theming + RTL Foundation

Phase 4
Localization

Phase 5
Catalog & Product Discovery

Phase 6
Product Details & Variants

Phase 7
Shopping Cart

Phase 8
Checkout

Phase 9
Payments

Phase 10
Orders & Customer Account

Phase 11
Storefront Production Readiness

Phase 12
Admin Portal Foundation

Phase 13
Admin Catalog & Inventory

Phase 14
Admin Orders & Payments

Phase 15
Final QA & Optimization
```

There is intentionally **no Phase 0.5 API Contract Package**.

Backend API contracts are prepared and consumed as part of the foundation/integration workflow, but they are not treated as a separate implementation phase.

---

# 21. Phase 0 — Frontend Foundation + Testing

Status: **Complete** (2026-09-05) — see
`docs/completed/PHASE_0_COMPLETION_REPORT.md`.

Establish the Angular workspace.

Scope:

- Angular 22 workspace
- Storefront application
- Admin application
- Shared libraries
- Strict TypeScript
- Standalone architecture
- Routing foundation
- Storefront SSR
- Admin CSR
- Environment/configuration
- Vitest setup
- Playwright setup
- Testing conventions
- Basic CI test execution

Deliverable:

```text
Runnable Angular workspace
+
Storefront shell
+
Admin shell
+
Shared library foundation
+
Testing infrastructure
```

All Phase 0 acceptance criteria are satisfied (builds, SSR/CSR, boundaries,
unit/E2E tests, architecture audit 25/25). The baseline is ready for
**Phase 1 — Core Infrastructure**. No business features exist yet.

---

# 22. Phase 1 — Core Infrastructure

Status: **Complete** (2026-09-05) — see
`docs/completed/PHASE_1_COMPLETION_REPORT.md`.

Build infrastructure used by all features.

Scope:

- HttpClient
- API client foundation
- Functional interceptors
- API configuration
- Error normalization
- ProblemDetails mapping
- Correlation ID handling
- API cancellation
- Generated API types/client where applicable
- Pagination abstraction
- Shared resource-state pattern
- Common loading/error/empty UI

Deliverable:

```text
Stable frontend ↔ backend communication foundation
```

All Phase 1 acceptance criteria are satisfied (typed API client,
interceptors, error normalization, correlation, cancellation, pagination,
resource state, async UI, integration slice, unit/HTTP/E2E tests,
architecture audit 29/29). The baseline is ready for
**Phase 2 — Identity & Authentication**. No business features exist yet.

---

# 23. Phase 2 — Identity & Authentication

Status: **Complete** (2026-09-09) — see
`docs/completed/PHASE_2_COMPLETION_REPORT.md`.

Scope:

- Login
- Registration
- Logout
- Session restoration
- Access token lifecycle
- Refresh token lifecycle
- 401 handling
- Auth guards
- Role guards
- Current user

Deliverable:

```text
Authenticated Storefront
+
Protected Admin foundation
```

---

# 24. Phase 3 — UI System + Theming + RTL Foundation

Status: **Complete** (2026-09-10) — see
`docs/completed/PHASE_3_COMPLETION_REPORT.md`.

Scope:

- Storefront layout
- Admin layout foundation
- Header
- Navigation
- Footer
- Sidebar
- Responsive layout
- Design system primitives
- Design tokens
- CSS variables
- Light/Dark themes
- RTL-safe components
- Responsive foundations

RTL is implemented as part of the design foundation, not as a later correction.

Deliverable:

```text
Shared UI primitives
+
Light/Dark theming
+
Storefront & Admin shells
+
RTL-safe responsive foundation
```

The UI foundation is ready for **Phase 4 — Localization & Culture Management**.

---

# 25. Phase 4 — Localization

Status: **Complete** (2026-09-10) — see
`docs/completed/PHASE_4_COMPLETION_REPORT.md`.

Scope:

- `en`
- `fr`
- `de`
- `es`
- `ar`
- Language switching
- Translation loading
- Culture persistence
- Backend culture synchronization
- LTR/RTL direction switching
- Date/number/currency formatting
- Localized validation and API errors

Deliverable:

```text
Fully localized and RTL-aware application foundation
```

All Phase 4 acceptance criteria are satisfied (centralized cultures,
translations with fallback, culture state and switching, direction
integration, backend culture propagation, culture-aware formatting,
localized validation and API errors, SSR/E2E validation, architecture
audit 97/97). The baseline is ready for **Phase 5 — Catalog & Product
Discovery**. No business features exist yet.

---

# 26. Phase 5 — Catalog & Product Discovery

Status: **Complete** (2026-09-12) — see
`docs/completed/PHASE_5_COMPLETION_REPORT.md`.

Scope:

- Home
- Categories
- Product listing
- Search
- Filtering
- Sorting
- Pagination
- Product cards
- Loading/empty/error states
- Responsive behavior
- Localization
- Tests

Deliverable:

```text
Customer can discover products
```

All Phase 5 acceptance criteria are satisfied (lazy catalog feature with
feature-scoped signal state, coherent `CatalogQueryState`, backend search /
filter / sort / pagination over `GET /catalog`, reusable product cards and
grid, differentiated resource states, 5-culture localization with RTL-safe
rendering, responsive single-component UI, SSR-compatible pages with
transfer-state hydration and dynamic metadata, unit/component/integration
tests, catalog E2E journey, architecture audit 97/97). The baseline is
ready for **Phase 6 — Product Details & Variants**. Product
details/variants/cart remain explicitly deferred.

---

# 27. Phase 6 — Product Details & Variants

Status: **Complete** (2026-09-12) — see
`docs/completed/PHASE_6_COMPLETION_REPORT.md`.

Scope:

- Product details
- Image gallery
- Variants
- SKU
- Pricing
- Availability
- Specifications
- Variant selection
- Quantity
- Add to cart

Deliverable:

```text
Complete product selection experience
```

All Phase 6 acceptance criteria are satisfied (lazy product-details
feature with feature-scoped signal state covering product,
specifications, images, variants, selection, orderability, quantity,
and submission; variant-as-purchasable-unit with live SKU binding;
contract-honest omission of price/availability with test-pinned
surfaces; image gallery with fallbacks; full resource states incl.
Not Found; 5-culture localization with RTL-safe rendering;
responsive single-component UI; SSR with per-id TransferState
hydration and dynamic metadata; unit/component/integration tests;
product-details E2E journey; architecture audit 97/97). Production
add-to-cart submission stays parked behind the documented contract
gap (no customer-readable price source — see `docs/adr/016–017`),
with the button, machine, façades, and payload implemented, tested,
and Phase 7-ready. The baseline is ready for **Phase 7 — Shopping
Cart**. No cart pages, cart state, persistence, or merge exist yet.

---

# 28. Phase 7 — Shopping Cart

Status: **Complete** (2026-09-16) — see
`docs/completed/PHASE_7_COMPLETION_REPORT.md`.

Scope:

- Guest cart
- Authenticated cart
- Add/update/remove
- Clear cart
- Totals
- Persistence
- Login → cart merge
- Merge conflict behavior
- Error/loading/empty states

Mandatory acceptance criterion:

```text
Guest
  ↓
Add items
  ↓
Login
  ↓
Cart Merge
  ↓
Authenticated Cart
```

The merge scenario must have automated test coverage.

All Phase 7 acceptance criteria are satisfied (guest cart with
contract-persisted identity and expiration recovery; authenticated
cart established session-driven with refresh retention; full CRUD in
both contexts; backend-authoritative totals with no local price math;
feature-local signal state; Guest → Login → Cart Merge with
backend-atomic behavior, duplicate prevention, and failure handling;
loading/empty/success/error states; 5-culture localization with
RTL-safe rendering and polite success announcements; responsive
single-component UI; keyboard/ARIA coverage with focus repair;
unit/component/integration tests; mandatory merge E2E journey plus
edge suites; boundary audit 8/8; architecture audit 97/97). The
baseline is ready for **Phase 8 — Checkout**. No checkout, payment,
order, or shipping logic exists in the Phase 7 touchpoints.

---

# 29. Phase 8 — Checkout

Status: **Complete** (2026-09-17) — see
`docs/completed/PHASE_8_COMPLETION_REPORT.md`.

Scope:

- Checkout page
- Customer information
- Address
- Shipping information
- Order summary
- Validation
- Create order
- Checkout state
- Failure handling

The frontend does not implement the backend Saga.

All Phase 8 acceptance criteria are satisfied (contract-aliased
`CreateOrderRequest`/`CreateOrderResponse` with zero client price math;
feature-local `CheckoutApiService` with `Idempotency-Key` mint and
context transport; route-provided `CheckoutState` with Initial →
Loading → Ready → Submitting → Success/Failure workflow, submit locks,
and same-key transport retry; typed Reactive Forms for shipping +
billing with contract-mirroring validators and page-localized copy;
backend-facts-only order summary; orchestrating checkout page with
live cart consumption, failure-recovery matrix, and Phase 9 result
handoff; 5-culture localization with RTL-safe rendering, responsive
single-component UI, and keyboard/ARIA coverage with failure-banner
focus management; unit/component tests; full checkout E2E journey plus
edge suites; architecture audit 97/97). The baseline is ready for
**Phase 9 — Payments**. No payment, Stripe, order-polling, or saga
logic exists in the Phase 8 touchpoints.

---

# 30. Phase 9 — Payments

Status: **Complete** (2026-09-19) — see
`docs/completed/PHASE_9_COMPLETION_REPORT.md`.

Scope:

- Payment initialization
- Stripe Elements integration
- Client-secret handling
- Payment UI
- Success
- Failure
- Pending
- Cancellation
- Retry

Backend payment verification and Saga processing remain authoritative.

All Phase 9 acceptance criteria are satisfied (audited payment
contracts with the no-client-secret-endpoint blocker pinned instead
of fabricated; lazy `payments` feature with auth-guarded
`/payment/:orderId` + `/result` routes and SSR-safe shells; thin
`PaymentApiService` over `ApiClient` with contract-blocked init/
confirm short-circuits and a real status read; route-provided
`PaymentState` with the 8-stage guarded lifecycle, `Initialized ≠
Succeeded` rule, and backend-truth overrides; isolated
`PaymentProvider`/`StripePaymentProvider` boundary with zero npm
Stripe dependency and platform-guarded browser touches; page
orchestration for init, provider setup, confirmation, verification,
and outcome routing; distinguished failure/recovery tables with
unknown-outcome submit locks; 5-culture `payment.*` localization
with sanitized error resolution; backend-issued order summary;
checkout `Continue to payment` seam; memory-only secrets with
zero persistence/logging; unit/component coverage plus payments E2E
(4 green, 5 backend-gated-skipped) and checkout regression;
architecture audit 102/102). The baseline is ready for **Phase 10
— Orders & Customer Account**. No order saga, inventory
compensation, payment verification, webhook, or secret handling
exists outside its owning layer.

---

# 31. Phase 10 — Orders & Customer Account

Status: **Complete** (2026-09-22) — see
`docs/completed/PHASE_10_COMPLETION_REPORT.md`.

Scope:

- Account
- Profile
- Orders list
- Order details
- Order status
- Payment status
- Order history
- Appropriate authorization and ownership behavior

Deliverable:

```text
Complete customer account experience
```

All Phase 10 acceptance criteria are satisfied (audited orders
contracts with payment/history gaps pinned instead of fabricated;
lazy `account` boundary with guarded shell, route-provided
`AccountState` over `GET /auth/me`, and read-only profile; paged
orders list with response-effective pager over `GET /orders`; order
details over `GET /orders/{id}` with `401`/`403`/`404`/generic
handling; independent localized order/payment status badges with
unknown-value fallbacks; bounded post-payment sync loop (immediate +
2s ticks, 30-tick budget, terminal stop, teardown on destroy) with
pending/exhausted UI and no history timeline (no backend history
contract); deep-linkable lazy routes with `authGuard` return-URL
redirects and backend-authoritative ownership; 5-culture
`account.*`/`orders.*`/`payment.result.viewOrder` localization with
RTL-safe logical CSS, responsive layouts, and focus-managed
accessibility; HTTP-level integration specs plus orders E2E journeys
(5 green, 1 provider-gated-skipped); architecture audit 102/102).
The baseline is ready for **Phase 11 — Storefront Production
Readiness**. No admin functionality, no totals math, and no status
derivation exist anywhere in the customer account area.

---

# 32. Phase 11 — Storefront Production Readiness

Status: **Complete** (2026-09-25) — see
`docs/completed/PHASE_11_COMPLETION_REPORT.md`.

Scope:

- SSR verification
- SEO metadata
- OpenGraph
- Image optimization
- Lazy loading
- Performance verification
- Accessibility
- Responsive testing
- Error pages
- 404/500 handling
- Loading/skeleton UX
- Security review
- Production-oriented verification

Deliverable:

```text
Storefront v1 Production Ready
```

All fifteen sub-phases (11.1–11.15) are done in dependency order.
Storefront-wide verification: architecture audit 102/102, storefront
unit/component 115 files / 1363 passed, libs 58 files / 397 passed,
admin 8 files / 20 passed (untouched), production build green (15/15
routes prerendered, initial ~361 kB raw / ~100 kB transfer), critical
Playwright journeys green (provider-gated skips documented).
Decisions recorded in `docs/adr/023–025`. Known limitations and the
Phase 12 handoff live in the completion report. The baseline is ready
for **Phase 12 — Admin Portal Foundation**; **Phase 15 — Final QA &
Optimization** remains responsible for final system-wide verification.

---

# 33. Phase 12 — Admin Portal Foundation

Status: **Complete** (2026-09-26) — see
`docs/completed/PHASE_12_COMPLETION_REPORT.md`.

Scope delivered:

- Admin authentication (login over shared session infrastructure)
- Authorization (`Admin`/`SuperAdmin` via existing guards, backend-authoritative)
- Admin layout (eager shell: sidebar, header, outlet, notification host)
- Sidebar (nested, icons, active state, drawer)
- Dashboard foundation (session card, upcoming-module grid, no invented APIs)
- Tables (`DataTable<T>`)
- Forms (field-errors, field, text/textarea/select/checkbox, actions)
- Filters (search, date-range, filter bar)
- Pagination (`PagedResult`-driven pager)
- Dialogs (accessible modal with focus trap)
- Notifications (service → host toasts/alerts)
- Admin-specific UI (admin-owned shared primitives; `libs/ui` stays closed — see `docs/adr/026`)

All Phase 12 acceptance criteria are satisfied (protected routes,
role model, shell + navigation, dashboard, table/pagination,
filter/form primitives, dialog, notifications, Signals-only state,
loading/empty/error discipline, 5-culture localization with RTL-safe
rendering, theme integration, responsive behavior, unit/component
specs, admin E2E journeys incl. login flow/RTL/theme/mobile,
audit 106/106, both builds green). Decisions recorded in
`docs/adr/026`. Known limitations and the Phase 13 handoff live in
the completion report. The baseline is ready for **Phase 13 — Admin
Catalog & Inventory**. No business features exist yet.

---

# 34. Phase 13 — Admin Catalog & Inventory

Status: **Complete** (2026-09-27) — see
`docs/completed/PHASE_13_COMPLETION_REPORT.md`.

Scope delivered:

### Catalog

- Products (list/create/edit/details/lifecycle)
- Product Variants (list/details/create/edit/delete, creation-only pricing)
- Categories (list/details/create/edit/lifecycle, flat parent model)
- Product Images (add/edit/delete/set-primary/reorder, URL-only)
- Product Specifications (add/edit/delete)

### Inventory

- Stock (single-SKU lookup, verbatim quantities)
- Inventory status (backend-provided state, no invented thresholds)
- Reservations (single-id lookup, lifecycle backend-owned)
- Inventory adjustments (additive form + confirm + backend-returned result)

All Phase 13 acceptance criteria are satisfied (real backend
contracts with contract-honest omissions pinned instead of
fabricated, protected routes, loading/empty/error discipline, typed
Reactive Forms with backend field-error projection, duplicate-submit
prevention, Phase 12 primitive reuse plus two spec-pinned table
extensions, clean feature boundaries, no duplicated business rules,
5-culture localization with RTL-safe rendering, responsive behavior,
unit/component specs, 13 admin catalog/inventory E2E journeys plus
re-verified access-control suites, audit 106/106, both builds
green). Decisions recorded in `docs/adr/027–028`. Known limitations
and the Phase 14 handoff live in the completion report. The baseline
is ready for **Phase 14 — Admin Orders & Payments**.

---

# 35. Phase 14 — Admin Orders & Payments

Scope:

### Orders

- Orders list
- Filtering
- Order details
- Status
- Customer information

### Payments

- Payment status
- Payment details
- Failed payments
- Payment history

---

# 36. Phase 15 — Final QA & Optimization

Scope:

- Full unit/component verification
- Full E2E verification
- Accessibility audit
- RTL verification
- Localization verification
- Responsive verification
- Browser verification
- Performance analysis
- Bundle analysis
- SSR/hydration verification
- Security review
- Final architecture review
- Documentation synchronization

This phase is final verification, not the beginning of testing.

---

# 37. Vertical Slice Development Protocol

Every feature should follow:

```text
Requirement
    ↓
Backend Contract
    ↓
Feature Data Access
    ↓
Feature State
    ↓
UI Components
    ↓
Page / Route
    ↓
Loading / Empty / Error
    ↓
Localization / RTL
    ↓
Tests
    ↓
Acceptance Criteria
```

Do not implement the frontend as a long sequence of disconnected technical layers.

A phase should produce a usable capability.

---

# 38. Definition of Done

A frontend feature is complete when:

- It works against the real backend contract.
- Routing and lazy loading are correct.
- Loading state is handled.
- Empty state is handled where applicable.
- Error state is handled.
- Localization is implemented.
- RTL/LTR behavior is correct.
- Responsive behavior is verified.
- Accessibility is considered.
- Important behavior has unit/component tests.
- Critical user journeys have E2E coverage.
- No unnecessary cross-feature coupling was introduced.
- Backend business rules remain in the backend.

---

# 39. Documentation Responsibilities

The frontend project should maintain:

```text
docs/
├── PROJECT_CONTEXT.md
├── ARCHITECTURE.md
├── phases/
├── completed/
└── adr/
```

Important frontend implementation decisions should be reflected in the appropriate documentation.

The Project Context remains the master source for:

- Current project state
- Architectural direction
- Technology baseline
- Implementation roadmap
- Important constraints
- Development protocol

The detailed architecture remains in `ARCHITECTURE.md`.

---

# 40. Final Project Direction

The overall system progression is:

```text
Backend
    ↓
Stable API Contracts
    ↓
Angular Foundation
    ↓
Storefront
    ↓
Customer Commerce Journey
    ↓
Storefront Production Readiness
    ↓
Admin Portal
    ↓
Final Integration
    ↓
Production-Ready Enterprise Commerce Platform
```

The project must remain understandable, testable, maintainable, and evolvable.

Do not introduce architectural complexity unless it solves a demonstrated problem.

The primary frontend goal is not to reproduce backend architecture inside Angular. It is to provide a clean, performant, localized, accessible, and production-oriented client that respects the backend's boundaries.
