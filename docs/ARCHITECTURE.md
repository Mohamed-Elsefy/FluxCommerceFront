# FluxCommerce Angular — Architecture

> Architectural reference for the entire frontend lifecycle. New
> features, components, services, state, and shared functionality
> follow the boundaries and principles defined here. Full phase
> history: `docs/IMPLEMENTATION_PLAN.md`. Decisions: `docs/adr/`.

---

## 1. Purpose

This document defines the frontend architecture for the FluxCommerce Angular project.

The frontend consists of:

- **Storefront** — customer-facing application, SSR-enabled and optimized for SEO.
- **Admin Portal** — internal administration application, CSR-based.
- **Shared libraries** — reusable infrastructure and UI capabilities shared by both applications.

The architecture aligns with the modular boundaries and production-oriented approach of the FluxCommerce backend while respecting Angular-specific concerns.

---

## 2. Technology Baseline

The frontend is based on:

- Angular 22
- TypeScript with strict mode enabled
- Standalone components
- Standalone routing
- Signals for reactive state
- SignalStore or NgRx only when state complexity justifies it
- Angular `HttpClient` (only via `libs/api` `ApiClient`)
- Functional HTTP interceptors
- Typed Reactive Forms
- SSR for Storefront
- CSR for Admin Portal
- Vitest for unit/component testing
- Playwright for end-to-end testing
- CSS custom properties and design tokens for theming

Prefer Angular platform capabilities and simple solutions before introducing additional libraries.

---

## 3. Workspace Architecture

One Angular workspace with multiple applications and shared libraries:

```text
FluxCommerce Angular Workspace
│
├── apps/
│   ├── storefront/
│   │   └── src/app/
│   │       ├── core/            # removed (was empty scaffolding)
│   │       ├── layout/
│   │       ├── features/
│   │       ├── shared/          # storefront-owned shared UI (pager, status badge)
│   │       ├── dev/             # dev-only surfaces (design preview)
│   │       └── app.routes.ts
│   │
│   └── admin/
│       └── src/app/
│           ├── layout/
│           ├── features/
│           ├── shared/          # admin-owned shared UI (table, pager, forms, dialog, …)
│           └── app.routes.ts
│
└── libs/
    ├── api/
    ├── auth/
    ├── ui/
    ├── i18n/
    ├── theming/
    ├── models/
    └── utils/
```

Nx may be used as workspace/build tooling where it provides meaningful dependency boundaries or affected builds. The architecture itself must not depend on Nx-specific abstractions unless they provide clear value.

Conventions: the application shell stays eager while pages lazy-load through `loadComponent` (or `loadChildren` feature boundaries). Dev-only surfaces live under `app/dev/`, never under `features/`. Single-page entries (e.g. the admin dashboard) keep their providers on the route — a `*.routes.ts` wrapper without children is unjustified indirection.

---

## 4. Application Responsibilities

### 4.1 Storefront

The Storefront owns the customer-facing commerce experience:

```text
Home
Catalog
Product
Cart
Checkout
Payments
Orders
Account
Authentication
```

SSR applies to SEO-sensitive public pages (home, category, listing, product details). Authenticated customer areas do not require SEO treatment.

### 4.2 Admin Portal

The Admin Portal owns internal commerce administration:

```text
Dashboard (adaptive per-entitlement sections + catalog card)
Catalog (products, variants, categories, images, specifications)
Inventory (stock/reservation lists + counts, single lookups, adjustments)
Orders (platform-wide list with filters, counts, details, force-cancel, refund)
Payments (platform-wide list with filters, stats, details — read-only)
Users (delegated reads; SuperAdmin-only writes and creation)
```

The portal is a guarded eager shell (sidebar, header, main outlet, notification host) over lazy routes: public `/login` and `/forbidden` outside the shell, `Admin`/`SuperAdmin`-guarded nested features inside. Guards stay UX-only (`permissionGuard` over `route.data['permissions']`, OR semantics, `SuperAdmin` bypass); the backend stays authoritative. The Admin Portal is CSR-oriented (authenticated pages, no SEO).

---

## 5. Feature-Based Architecture

Business functionality is organized by feature rather than by technical layer:

```text
features/catalog/
├── pages/
├── components/
├── data-access/
├── state/
├── models/
└── catalog.routes.ts
```

A feature owns the code required to implement its business capability:

- **Pages** — route-level components, page composition, interaction orchestration.
- **Components** — feature-specific presentation and UI behavior.
- **Data Access** — API services, server communication, API↔frontend mapping.
- **State** — feature state, derived state, actions/effects where required (route-provided `@Injectable()`, never `providedIn: root`).
- **Models** — feature-specific types and view models (wire mirrors are aliases over `@flux/models`, never re-declared).

Shared code is extracted only when genuinely reusable:

- App-owned shared UI (`apps/*/shared/`) for dumb, business-free components used by multiple features of one app (grown by extension with specs, never by fork).
- `libs/` for cross-application infrastructure. `libs/ui` is an audit-pinned closed set — it never gains business widgets.

Cross-feature communication uses stable contracts, never feature internals. Reference implementation: the cart feature exposes exactly one public seam — token `CART_CAPABILITIES` + `CartCapabilities` interface (`features/cart/cart-capabilities.ts`) with a single route-provided implementation. `checkout` and `product-details` consume the cart exclusively through it; no `cart/state|models|data-access` import exists outside `cart/` (audit-enforced). Feature state shapes that must cross a boundary (e.g. cart identity snapshots) are canonicalized in `@flux/models`.

---

## 6. Shared Libraries

Shared libraries provide cross-feature infrastructure and reusable capabilities. Every library is consumed only through its `@flux/*` barrel; deep imports and relative traversal into `libs/` are forbidden.

### `libs/api`

HTTP/API infrastructure: configuration, typed `ApiClient` (the single sanctioned `HttpClient` user), functional interceptors (correlation, request-config, auth-token, auth-recovery, error-hook), error normalization (`ApiError`, status-first classification), correlation IDs, cancellation lifecycle, query/pagination abstractions (`normalizePagination`, `toQueryParams`, `totalPagesOf`, `hasNext/PreviousPage`, `next/previousPageQuery`), contracts (`ApiResponse`, `PagedResult`, endpoints), and `IdentityApiService`.

Provider seams (`ACCESS_TOKEN_PROVIDER`, `AUTH_RECOVERY_PROVIDER`, `ACTIVE_CULTURE_PROVIDER`) let `libs/api` stay decoupled from its implementers. Business-specific API logic remains inside its owning feature.

### `libs/auth`

Authentication session and lifecycle, organized by capability (`state/`, `session/`, `tokens/`, `guards/`, `components/`):

- Tri-state signal session (`initializing | anonymous | authenticated`); `initialized` is the single readiness signal.
- Token storage (refresh persisted versioned and platform-guarded; access memory-only; passwords never persisted).
- Single-flight refresh with login/register/refresh URL exclusion and at-most-once retry.
- `authGuard` (anonymous → `/login?returnUrl=`), `roleGuard` (`route.data['roles']`, OR, strict claims, fail-closed → `/forbidden`), `permissionGuard` (`route.data['permissions']`, OR, `SuperAdmin` bypass).
- `AuthService` (sole writer), `SessionRestoreService`, `AuthNav` widget.

Applications compose it once at bootstrap; the interceptor pipeline consumes it only through provider seams.

### `libs/ui`

Reusable presentation components and design-system primitives (audit-pinned closed set — business widgets stay feature-owned):

```text
Presentation  Button  Icon  Input  Badge  Chip  Card  Spinner  Alert  Divider  ThemeToggle
Layout        Container  Stack  Grid  Flex
Async states  LoadingIndicator  Skeleton  EmptyState  RetryButton  ErrorState
```

Every component lives in its own folder (`.ts` / `.html` / `.css` / `.spec.ts`); templates and styles are never inline. Components consume theming tokens exclusively, import no `@flux/*` barrel, and never touch business features, HTTP, or the theme service. Selectors carry the `flux-` prefix.

### `libs/i18n`

Localization and culture platform, organized by capability (`culture/`, `translations/`, `formatting/`, `errors/`):

- `culture.ts` (`Culture`, `SUPPORTED_CULTURE_METADATA` for `en`/`fr`/`de`/`es`/`ar` with `ar → rtl`, `DEFAULT_CULTURE`, validation, direction resolution — pure, SSR-safe).
- `CultureService` (signals, persisted → browser → default precedence, runtime switching, single writer of document `dir`, `provideCulture()` initializer).
- Synchronous translation loading with nested `namespace.group.key` lookup, `{param}` interpolation, deterministic fallback (target → `en` → key path).
- `Intl`-based date/number/currency formatting (`ar` renders Arabic-Indic digits).
- Angular `ValidationErrors` → `common.validation.*` and stable-code/status → `errors.*` resolvers with generic fallbacks.

Feature libraries own feature-specific translation content; `libs/i18n` never imports feature code, HTTP, or business domains.

### `libs/theming`

Visual foundation: `tokens.css` (centralized `:root` custom properties; Dark overrides under `:root[data-theme='dark']` reuse the same names), `reset.css` (wired before tokens in both apps), `ThemeService` (Light/Dark signal state, `data-theme` application, guarded persistence, `provideTheming()` initializer), and `theme.ts` constants. Components consume variables; they never inject the service.

### `libs/models`

Genuinely shared types that cross application/feature boundaries: `common/` primitives (`EntityId`, `Guid`, `IsoDateString`, `PageQuery`) plus canonical pure models (`money`, `failure`/`NormalizedFailure`, `cart-identity`/`CartSnapshot`, `image`, `quantity`) with unit-tested helpers, and per-domain wire mirrors with contract audits. Feature-specific models stay inside their feature; features alias (never re-declare) canonical shapes.

### `libs/utils`

Generic utilities with no business ownership (`guards`, `canonical-url`, `social-metadata` — pure, SSR-safe, tested). Not a dumping ground: SEO growth beyond this scale justifies a dedicated home.

---

## 7. Dependency Boundaries

Dependencies flow toward shared infrastructure and remain explicit:

```text
Applications
    ↓
Features
    ↓
Shared Libraries
```

A feature must not directly depend on another unrelated feature's internal implementation:

```text
Catalog → Catalog Data Access
Cart    → Cart Data Access
Orders  → Orders Data Access
```

Cross-feature communication uses stable contracts (e.g. the cart capabilities seam), shared abstractions, or backend APIs. The architecture audit enforces: no cross-app imports, no deep `@flux` imports, no relative traversal into `libs/`, libraries never importing applications, single `HttpClient` ownership, no circular dependencies, and no cart-internals imports outside the cart feature.

---

## 8. Component Architecture

All components are standalone, `OnPush`, with markup and styles in sibling files (never inline `template`/`styles`).

### Smart / Container Components

Read feature state, trigger actions, coordinate data, handle page-level behavior (e.g. `ProductsPage` → `CatalogState` → `ProductCard`).

### Presentational Components

Render data, emit user interactions, hold reusable visual behavior. Presentational components avoid direct API access and hold no business-named modules outside their owning feature.

Test-host components inside `*.spec.ts` files may keep inline templates; they are test-only scaffolding, not shipped components.

---

## 9. State Management

State is managed at the smallest appropriate scope, following one proven shape: route-provided services with plain signals and computeds, resource slots via `createResourceState`, explicit `load*` calls with `untracked` route-param effects (settled responses must never reschedule fetch effects into loops), supersede-or-lock concurrency, and envelopes unwrapped in state.

### Local UI State

Component signals: dialog visibility, selected tab/image, temporary form state, expand/collapse.

### Feature State

Signals or feature stores: catalog filters/pagination/selection, cart slot + identity + active operation (pessimistic one-at-a-time lock), checkout workflow (`initial → loading → ready → submitting → success | failure`, derived — never set), payment lifecycle (table-driven guarded machine, `Initialized ≠ Succeeded`, backend verdicts override provider claims), orders/account slots.

Feature states stay isolated by construction (checkout holds no cart lines, cart holds no checkout data); pages bridge them through explicit seams with snapshot-only coupling (`cartId`/`version`/line count).

### Global State

Only `Authentication`, `Current User`, `Culture`, `Theme`, `Application Configuration`. Nothing else is global (the only root-provided admin services are the notification center and stateless login orchestration).

### Complex State

SignalStore or NgRx only with demonstrated complexity (coordinated async operations, significant derived state, multi-screen coordination). No feature has yet needed it.

---

## 10. API Communication

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

Components hold no scattered direct HTTP calls. The API layer provides strongly typed contracts, authentication handling, error normalization, cancellation support, and consistent request configuration. Backend API contracts are the source of truth. See `docs/frontend-contract/` and §5 of `docs/PROJECT_CONTEXT.md` for envelopes, pagination, headers, and idempotency conventions.

---

## 11. Authentication and Authorization

Conceptual flow: login → session (15m access JWT in memory + 7d rotating opaque refresh) → Bearer-authenticated requests → proactive refresh (~13–14m) → on `401`, single-flight refresh and at-most-once retry → on refresh `401`, drop both tokens and re-login.

Responsibilities: login, registration, logout, session restoration, access/refresh-token management, 401 handling, route protection, role- and permission-based protection. Authorization never relies on hiding UI elements; backend authorization is authoritative.

Current contract state: roles `Customer`/`Admin`/`SuperAdmin` (SuperAdmin passes every gate); 9-value action permission catalog (`orders.read|cancel|refund`, `payments.read|stats`, `inventory.read|manage`, `catalog.manage`, `users.read`); `Admin` role grants nothing by itself; grants land on next login/refresh; `GET /auth/me` exposes authoritative `permissions[]`; dashboard adapts per entitlement (unauthorized sections are `null`/`[]`, never 403); user writes and admin creation are `SuperAdmin`-only.

---

## 12. Error Handling

API errors normalize centrally:

```text
HTTP Error
    ↓
HTTP Interceptor
    ↓
Normalized API Error (ApiError: status/code/message/validationErrors/correlationId/traceId)
    ↓
Stable Error Code (best-effort — business errors carry none)
    ↓
Localized User Message (display backend detail verbatim; resolve codes, never message text)
    ↓
UI
```

Frontend business logic must not depend on server-generated human-readable error text. Shared `NormalizedFailure` classifiers in `@flux/models` cover the generic status-first predicates; features keep only domain-specific classifiers (idempotency, cancel-conflict, retry budgets).

---

## 13. Resource State Pattern

Loading, success, empty, and error states are a common frontend pattern:

```text
Idle
 ↓
Loading
 ↓
 ├── Success
 ├── Empty
 └── Error (+ retry)
```

`libs/api` owns the `ResourceState<T>` model and `createResourceState`/`loadResourceState`; `libs/ui` owns the presentation (loading, skeleton, empty, error, retry). Features decide state and behavior, including empty-where-applicable and dataless-envelope-as-contract-violation handling.

---

## 14. Pagination, Filtering and Sorting

Pagination is a reusable API/UI pattern over the backend's documented contract (`PagedResult<T>` — wire carries only `items/totalCount/pageNumber/pageSize`; `totalPages`/`hasNext`/`hasPrevious` derive client-side via `totalPagesOf` and friends; `next/previousPageQuery` build moves without hand-built strings).

The wire defaults are `pageNumber 1` / `pageSize 20` (max 100); pager UI renders RESPONSE-effective values; page moves commit through coherent query state so search/filter/sort survive navigation. Filtering and sorting are typed feature state (e.g. `CatalogQueryState` with page-reset rules and one backend/route funnel); fixed server orderings (newest-first, by-SKU) take no sort params. Feature-owned pagers share one implementation per app (`StorefrontPagination`; admin `AdminPagination`); the catalog pager stays separate for its distinct visuals.

---

## 15. Localization and RTL

Supported cultures (backend-identical): `en`, `fr`, `de`, `es`, `ar`. The frontend supports translation, language switching, culture persistence, backend culture synchronization, date/number/currency formatting, localized validation, and localized API errors.

RTL is a design requirement from the beginning: CSS logical properties exclusively (audit-enforced workspace-wide, including stylesheets), no physical-direction properties, no forced text direction, no direction branching in code, no per-direction component duplicates. `CultureService` applies document `dir` from the active culture (`ar → rtl`). Shell chrome localizes through app-owned `layout.*` bundles; features own their bundles; validation and API errors resolve through the Phase 4 platform resolvers.

Public SEO/social metadata is page-owned (`title`/`description`/canonical/`og:*`) with app-relative URLs and shared idempotent helpers; private pages expose no description, canonical, or social tags; error states use honest fallbacks (listing canonical, fallback image, `noindex` on route 404s).

---

## 16. Theming

CSS custom properties and design tokens, switched through `ThemeService` (`<html data-theme="light|dark">`, guarded persistence, SSR-safe server default shell). Components consume tokens, never hard-coded theme values; never inject the theme service. Both themes meet WCAG AA text contrast (audit-enforced). Canonical breakpoints live in theming tokens (`--breakpoint-sm/md/lg/xl`: 30/48/64/80rem); media queries repeat those values exactly. Additional themes must be possible without rewriting feature components. Visual language: `docs/DESIGN.md`.

---

## 17. Responsive Design

Mobile, tablet, and desktop are supported through responsive CSS and layout primitives — never duplicated Mobile/Desktop components. Display type and container padding scale fluidly (`clamp()`); layout children shrink below content size (`min-inline-size: 0`); zero horizontal overflow is E2E-verified at 375/768/1280px.

---

## 18. Storefront Commerce Flow

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
Payment Initialization
  ↓
Payment Provider
  ↓
Payment Result
  ↓
Order Status
```

The frontend presents the workflow; the backend orchestrates Order/Inventory/Payment Saga processing. The frontend never reproduces backend payment or order orchestration logic.

---

## 19. Cart Architecture

Anonymous and authenticated carts with a mandatory tested merge:

```text
Guest
  ↓
Guest Cart (opaque cartId bookmark, expiration recovery)
  ↓
Login
  ↓
Cart Merge (atomic, duplicate-safe, failure-handled)
  ↓
Authenticated Cart (session-driven, refresh-retained)
```

The cart is an API capability — the frontend never depends on backend storage details. Backend-authoritative totals: counts and currency project from backend lines; money slots stay `null` until a backend source provides them (the display-only estimate never submits). The cart feature exposes its reader + session lifecycle exclusively through the `CART_CAPABILITIES` seam; consumers hold snapshots (`cartId`/`version`/line count), never lines or prices.

---

## 20. Checkout and Payment

Separate concerns with an explicit handoff:

```text
Cart
  ↓
Checkout (typed addresses, backend-facts-only summary, Idempotency-Key, create order → Pending)
  ↓
Payment Initialization (by-order intent read; blocked until the backend lands the intent path — no fabricated endpoints)
  ↓
Payment Provider (isolated Stripe adapter, no npm Stripe dependency, secrets memory-only)
  ↓
Payment Result (backend verification hub)
  ↓
Order Status (bounded post-payment sync: immediate + 2s ticks, 30-tick budget, terminal stop)
```

Backend services own payment verification, order state transitions, inventory coordination, webhooks, idempotency, and Saga processing. Client-side confirmation never presents as final proof (`Initialized ≠ Succeeded`).

---

## 21. Product Architecture

Catalog/product UI supports categories, search, filtering, sorting, pagination, product cards, details, images, variants, SKU, pricing, availability (where the contract exposes it), and specifications — consuming API contracts, never assuming storage.

Presentation renders exactly what the contracts carry: list items show image/name/details-link (no fabricated price/availability); details bind name, description, specifications, `displayOrder` images, and the flat variant list with live SKU and backend-issued unit price (display only) bound to the selection; the selected variant is the source of truth for variant-specific data. Availability renders nowhere (inventory reads stay `Admin`-only).

---

## 22. Testing Architecture

Testing begins with the first implementation phase; a feature is complete only with tests (implement → test → verify → acceptance).

### Unit / Component Tests (Vitest)

Services, stores, state logic, utilities, validators, presentational components, feature behavior. Known hazard: the app runner shares one non-isolated worker, so specs must reset culture/localStorage state they mutate (see ADR-037).

### End-to-End Tests (Playwright, mocked transports)

Customer journeys (auth, catalog, product, cart, guest → login → merge, checkout, payment, orders, account) and admin journeys (access control, catalog/inventory/orders/payments/users, dashboard, navigation, localization/RTL/theme). Storefront E2E requires a live-capable environment (fails identically on clean HEAD without it — see ADR-037); admin suites run mocked-transport green.

---

## 23. SSR Strategy

SSR serves Storefront SEO-sensitive pages (home, category, listing, product details). Implementation avoids browser-only APIs during server rendering and handles hydration correctly (`TransferState` once per query/id, `untracked` route-param effects, platform-guarded browser touches, anonymous SSR shells reconciled post-hydration).

Production posture: explicit `RenderMode.Prerender` static routes (data-driven `:id` and `**` catch-all stay `RenderMode.Server`); `server.ts` guards `/api/*` with JSON 404 and serves static internals-free 404/500 pages; host validation is deployment configuration; unknown URLs return HTTP 200 with `noindex` (no status-code seam — recorded for Phase 15).

---

## 24. Performance Principles

Lazy-load feature routes; avoid unnecessary global state and subscriptions; prefer Signals; optimize images (priority, dimensions, lazy-below-fold, fallbacks); minimize duplicate API requests (untracked effects, single-use `TransferState`, single-flight lifecycles); keep shared libraries focused; avoid large dependencies; preserve SSR/hydration performance; measure before optimizing (initial ~361 kB raw / ~100 kB transfer inside budgets; Stripe constants split into a lazy module on evidence).

---

## 25. Security Principles

Never trust frontend authorization — the backend is the security boundary. Do not expose secrets in frontend configuration (bundle scanned secret-free, env files public-only); validate user input; avoid unsafe HTML rendering (zero `innerHTML`/sanitizer bypasses); access token memory-only with `Authorization` scoped to backend URLs; protect authenticated routes; never rely on hidden UI as authorization. Payment operations follow the provider's browser integration model (publishable key only, secrets memory-only, never stored/logged/URL-placed).

---

## 26. Development Workflow

Each feature is developed as a vertical slice:

```text
Requirement
   ↓
Backend Contract
   ↓
Feature API/Data Access
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

A feature is complete only when the complete user-facing slice works.

---

## 27. Architectural Rules

### Rule 1

Prefer feature ownership over global shared abstractions.

### Rule 2

Do not create shared code prematurely.

### Rule 3

Components should not directly own business API communication.

### Rule 4

Global state should contain only genuinely global concerns.

### Rule 5

Backend contracts are the source of truth for API integration.

### Rule 6

Backend authorization is authoritative.

### Rule 7

Business workflows remain in the backend.

### Rule 8

RTL and localization must be considered from the beginning.

### Rule 9

Every meaningful feature must include tests.

### Rule 10

Prefer simple Angular platform capabilities before introducing additional state-management or utility libraries.

---

## 28. Definition of Done

A frontend feature is considered complete when:

- The feature works against the real backend contract.
- Routes and lazy loading are correctly configured.
- Loading state is handled.
- Empty state is handled where applicable.
- Error state is handled.
- Localization is implemented.
- RTL/LTR behavior is correct where applicable.
- Responsive behavior is verified.
- Accessibility considerations are addressed.
- Unit/component tests exist for important behavior.
- E2E coverage exists for critical user journeys.
- No unnecessary cross-feature coupling is introduced.
- No business logic has been incorrectly moved from backend to frontend.

---

## 29. Architecture Evolution

This document is the baseline architecture, not a reason to prevent justified evolution. Changes require a concrete requirement, measurable complexity, or demonstrated limitation:

1. Update this document.
2. Document the reason for the change.
3. Identify affected features.
4. Update implementation conventions where necessary.
5. Keep the architecture and actual code synchronized.

The goal is a maintainable Angular 22 enterprise frontend, not architectural complexity for its own sake.

---

## 30. Implementation History

Phases 0–14, supplements S1–S3, and refactoring pass A–E are complete; Phase 15 (final QA) is open. The consolidated record — objectives, sub-phases, deliverables, metrics — lives in `docs/IMPLEMENTATION_PLAN.md`; decisions in `docs/adr/`. Retired per-phase plan and completion files were consolidated there; code docblocks may still cite the old `docs/phases/*` paths as historical provenance.
