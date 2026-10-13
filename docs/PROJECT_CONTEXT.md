# FluxCommerce — Project Context

> Master source for current project state, architectural direction,
> technology baseline, roadmap, constraints, and development protocol.
> Detailed architecture: `docs/ARCHITECTURE.md`. Full phase history:
> `docs/IMPLEMENTATION_PLAN.md`. Design system: `docs/DESIGN.md`.
> API source of truth: `docs/frontend-contract/`. Decisions:
> `docs/adr/`.

---

## 1. Purpose

FluxCommerce is a production-oriented Enterprise E-Commerce & Order Management Platform.

The project demonstrates real software engineering capabilities rather than collecting technologies. The system emphasizes:

- Strong modular boundaries
- Clean and maintainable architecture
- Reliable commerce workflows
- Concurrency handling
- Asynchronous processing
- Idempotency
- Failure recovery
- Observability
- Production-oriented testing

The backend is a **Modular Monolith**. The frontend is an Angular 22 multi-application workspace. Both are complete; the remaining open item is Phase 15 (final system-wide QA — see §14).

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
- Role-Based Authorization (plus action-level permissions, §7)
- Transactional Outbox
- Idempotent Consumers
- Saga orchestration
- Compensation workflows
- Stripe Payments
- Structured Logging
- OpenTelemetry / distributed tracing
- Localization (`en`, `fr`, `de`, `es`, `ar`)

Backend modules and capabilities:

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

The backend is complete and is the source of truth for implementation details. The frontend consumes its capabilities through explicit API contracts and must not reproduce backend business orchestration.

### 2.1 Backend Ownership Rules

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

Modules must not directly access or modify another module's persistence state. Cross-module communication uses approved contracts and integration events. The frontend must preserve these boundaries.

---

## 3. Angular Frontend

The frontend uses **Angular 22** and consists of two applications in one workspace:

```text
FluxCommerce Angular Workspace
│
├── Storefront
│   └── Customer-facing application (SSR-enabled, SEO-sensitive)
│
├── Admin
│   └── Administration application (CSR, authenticated, no SEO)
│
└── Shared Libraries
```

### 3.1 Workspace Layout

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

Business features stay feature-owned rather than being prematurely converted into shared libraries:

```text
features/catalog/
├── pages/
├── components/
├── data-access/
├── state/
├── models/
└── catalog.routes.ts
```

Cross-feature needs travel through stable contracts, shared abstractions, or backend APIs — never through another feature's internals. The cart feature's public seam (`CART_CAPABILITIES`) is the reference example.

### 3.2 Technology Baseline

- Angular 22
- Strict TypeScript
- Standalone components
- Standalone routing
- Signals
- SignalStore or NgRx only when justified by state complexity
- Angular HttpClient (only via `libs/api` `ApiClient`)
- Functional HTTP interceptors
- Typed Reactive Forms
- SSR for Storefront
- CSR for Admin
- Vitest (unit/component)
- Playwright (E2E)
- CSS custom properties + design tokens
- `data-theme` on the root element; logical CSS properties (RTL-first)

Prefer Angular platform capabilities and simple solutions before introducing additional libraries.

---

## 4. Frontend State Strategy

State is kept at the smallest appropriate scope.

### Local UI State

Component Signals for temporary UI state (dialog visibility, selected tab/image, expand/collapse).

### Feature State

Signals or feature stores for catalog filters/pagination/selection, cart, checkout, orders. Feature state is route-provided, never global, never `providedIn: root` (except the allowlisted notification/login services).

### Global State

Only genuinely global concerns:

```text
Authentication
Current User
Culture
Theme
Application Configuration
```

Do not place server data into one global store. Complex state may use SignalStore or NgRx only when justified.

---

## 5. API Communication

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

Components must not contain scattered business API calls. The backend API contract (`docs/frontend-contract/`) is the source of truth. Use strongly typed request/response contracts everywhere.

Key conventions:

- Success envelope `ApiResponse<T> { isSuccess, message, data }` (`data` nullable; `201` + `Location` on creates; `204` empty on most writes).
- Errors are `ProblemDetail` / `ValidationProblemDetail`; branch on `status` first (`code` is best-effort — business errors carry no machine code), never on message text; display backend `detail` verbatim.
- Pagination envelope `PagedResult<T> { items, totalCount, pageNumber, pageSize }` — `totalPages`/`hasNext` are client-side derivations; render pager state from RESPONSE-effective values.
- `Accept-Language` (or `?culture=`) on every operation; `X-Correlation-ID` per flow (echoed with `X-Request-ID` + `traceId` in bug reports).
- `POST /orders/checkout` requires an `Idempotency-Key` header (1–128 chars; same key + same body = replay, same key + different body = `409`).

---

## 6. Authentication & Authorization

The frontend follows the backend JWT + refresh-token architecture:

```text
Login
  ↓
Authenticated Session (access 15m in memory, refresh 7d opaque persisted)
  ↓
API Requests (Bearer injection centrally)
  ↓
401 → single-flight refresh → retry once → else re-login
```

The frontend supports login, registration, logout, session restoration, token lifecycle, 401 handling, auth guards, role guards, permission guards (`route.data['permissions']`, OR semantics, `SuperAdmin` bypass), and current-user state.

Roles: `Customer`, `Admin`, `SuperAdmin` (`SuperAdmin` passes every gate). Action-level permission catalog (9 values):

```text
orders.read | orders.cancel | orders.refund
payments.read | payments.stats
inventory.read | inventory.manage
catalog.manage
users.read
```

Grants apply on next login/refresh. `GET /auth/me` returns authoritative `permissions[]` for menu rendering. On `403`: single refresh + retry is legitimate (fresh grants), then render a locked state — never a retry loop, never a logout. Backend authorization remains authoritative; guards are UX-only.

---

## 7. Localization and RTL

Localization is first-class. Supported cultures (same identifiers as the backend):

```text
en
fr
de
es
ar
```

The frontend supports translation, language switching, culture persistence, backend culture synchronization (`Accept-Language`), date/number/currency formatting (Arabic-Indic digits via `ar-u-nu-arab`), localized validation, and localized API errors.

RTL is a design requirement from the beginning. CSS uses logical properties only:

```css
margin-inline
padding-inline
inset-inline
border-inline
text-align: start
```

No LTR-only UI fixed later; no direction branching in code; `CultureService` is the single writer of document `dir`.

---

## 8. Theming

- CSS custom properties + design tokens, consumed by components (never hard-coded values, never the theme service).
- Centralized `ThemeService` applying `data-theme="light|dark"` on the root element, persisted, SSR-safe.
- Initial themes: Light, Dark. Both meet WCAG AA text contrast (audit-enforced).
- Visual language is defined in `docs/DESIGN.md` (must-read before touching UI): neomorphic bubble surfaces, pill controls, squircle containers, brand accents (Cyber Lime primary, Electric Violet secondary, Tangerine urgency, Lavender tint).

---

## 9. Common Resource States

Loading, success, empty, and error states are a shared frontend pattern:

```text
Idle
 ↓
Loading
 ↓
 ├── Success
 ├── Empty
 └── Error (+ retry)
```

Shared UI provides consistent loading indicators, skeletons, empty states, error states, and retry actions. Features decide the appropriate state and behavior. Unknown backend enum values render verbatim with a neutral tone (forward compatibility) — never mapped, never dropped.

---

## 10. Commerce Flow

The primary Storefront flow:

```text
Home
  ↓
Catalog (search/filter/sort/pagination)
  ↓
Product Details (images, variants, SKU, pricing, specs)
  ↓
Add to Cart (guest + authenticated)
  ↓
Cart (guest → login → atomic merge → authenticated)
  ↓
Checkout (typed addresses, Idempotency-Key, create order)
  ↓
Payment (Stripe Elements via provider boundary, secret memory-only)
  ↓
Payment Result (backend verification)
  ↓
Orders & Account (list, details, bounded post-payment sync)
```

The frontend presents this workflow. The backend remains responsible for order orchestration, inventory reservation, payment processing and verification, webhooks, Saga transitions, compensation, idempotency, and failure recovery.

Commerce rules the frontend must preserve:

- Backend-authoritative money: values echo verbatim for display only — no totals math, no price derivation (single sanctioned exception: admin net-revenue display arithmetic, see ADR-036).
- Guest → authenticated cart merge is mandatory and test-covered.
- Payment initialization/confirmation cannot execute without the backend intent path — no fabricated endpoints.
- No order-history timeline, per-order payment status, or failure reasons exist on the wire — gaps stay pinned, never fabricated.
- Admin surfaces are permission-gated and read-only unless the contract exposes a mutation; `SuperAdmin` performs user writes and admin creation.

---

## 11. Testing Strategy

Testing starts with the first implementation phase and continues through refactoring. A feature is not complete because it works manually.

### Unit / Component (Vitest)

Services, stores, state logic, utilities, validators, components, feature behavior. Note: the app test runner uses a single non-isolated worker — specs must reset culture/localStorage state they mutate (known latent suite-order hazard, see ADR-037).

### E2E (Playwright, mocked transports)

Critical journeys: authentication, catalog browsing, product selection, add to cart, guest → login → cart merge, checkout, payment, order creation, admin access control and business journeys. Note: storefront E2E requires a live-capable environment; suites fail identically on clean HEAD without it (see ADR-037).

---

## 12. Implementation Roadmap

All core phases, supplements, and the refactoring pass are **complete**. Details (objectives, sub-phases, deliverables, metrics) live in `docs/IMPLEMENTATION_PLAN.md`.

```text
Phase 0    Frontend Foundation + Testing            ✅ Complete
Phase 1    Core Infrastructure                      ✅ Complete
Phase 2    Identity & Authentication                ✅ Complete
Phase 3    UI System + Theming + RTL Foundation     ✅ Complete
Phase 4    Localization                             ✅ Complete
Phase 5    Catalog & Product Discovery              ✅ Complete
Phase 6    Product Details & Variants               ✅ Complete
Phase 7    Shopping Cart                            ✅ Complete
Phase 8    Checkout                                 ✅ Complete
Phase 9    Payments                                 ✅ Complete
Phase 10   Orders & Customer Account                ✅ Complete
Phase 11   Storefront Production Readiness          ✅ Complete
Phase 12   Admin Portal Foundation                  ✅ Complete
Phase 13   Admin Catalog & Inventory                ✅ Complete
Phase 14   Admin Orders & Payments                  ✅ Complete
Phase 15   Final QA & Optimization                  ⏳ Open (not started)
Suppl. S1  Backend Contract Evolution               ✅ Complete
Suppl. S2  Adaptive Dashboard & Delegated Admin     ✅ Complete
Suppl. S3  Users Write Re-centralization            ✅ Complete
Refr. A–E  Frontend Refactoring Pass                ✅ Complete
```

There is intentionally no Phase 0.5 API contract package: contracts are consumed as part of the foundation/integration workflow from `docs/frontend-contract/`.

---

## 13. Vertical Slice Development Protocol

Every feature follows:

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

Do not implement the frontend as a long sequence of disconnected technical layers. A phase produces a usable capability.

---

## 14. Definition of Done

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

## 15. Documentation Responsibilities

The frontend maintains:

```text
docs/
├── PROJECT_CONTEXT.md      # this file — master state & direction
├── ARCHITECTURE.md         # architectural reference
├── IMPLEMENTATION_PLAN.md  # consolidated phases + sub-phases + status
├── DESIGN.md               # visual design system (must-read for UI)
├── frontend-contract/      # backend API source of truth
└── adr/                    # architecture decision records (001–037)
```

Retired per-phase plan and completion files were consolidated into `IMPLEMENTATION_PLAN.md`. Code docblocks may still cite the old `docs/phases/*` paths as historical provenance. Important implementation decisions are recorded as ADRs.

---

## 16. Final Project Direction

The overall system progression:

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
Refactoring Pass
    ↓
Final QA (Phase 15)
    ↓
Production-Ready Enterprise Commerce Platform
```

The project must remain understandable, testable, maintainable, and evolvable. Do not introduce architectural complexity unless it solves a demonstrated problem.

The primary frontend goal is not to reproduce backend architecture inside Angular. It is to provide a clean, performant, localized, accessible, and production-oriented client that respects the backend's boundaries.
