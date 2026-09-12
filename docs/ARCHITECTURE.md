# FluxCommerce Angular — Architecture

## 1. Purpose

This document defines the frontend architecture for the FluxCommerce Angular project.

It is the architectural reference for the entire frontend development lifecycle. New features, components, services, state, and shared functionality should follow the boundaries and principles defined here.

The frontend consists of:

- **Storefront** — customer-facing application, SSR-enabled and optimized for SEO.
- **Admin Portal** — internal administration application, CSR-based.
- **Shared libraries** — reusable infrastructure and UI capabilities shared by both applications.

The architecture is designed to align with the modular boundaries and production-oriented approach of the FluxCommerce backend while respecting Angular-specific concerns.

---

## 2. Technology Baseline

The frontend is based on:

- Angular 22
- TypeScript with strict mode enabled
- Standalone components
- Standalone routing
- Signals for reactive state
- SignalStore or NgRx only when state complexity justifies it
- Angular `HttpClient`
- Functional HTTP interceptors
- Typed Reactive Forms
- SSR for Storefront
- CSR for Admin Portal
- Vitest for unit/component testing
- Playwright for end-to-end testing
- CSS custom properties and design tokens for theming

The architecture should prefer Angular platform capabilities and simple solutions before introducing additional libraries.

---

## 3. Workspace Architecture

The project uses one Angular workspace containing multiple applications and shared libraries.

```text
FluxCommerce Angular Workspace
│
├── apps/
│   ├── storefront/
│   │   └── src/app/
│   │       ├── core/
│   │       ├── layout/
│   │       ├── features/
│   │       └── app.routes.ts
│   │
│   └── admin/
│       └── src/app/
│           ├── core/
│           ├── layout/
│           ├── features/
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

Nx may be used as the workspace/build tooling where it provides meaningful dependency boundaries, affected builds, or project tooling. The architecture itself must not depend on Nx-specific abstractions unless they provide clear value.

---

## 4. Application Responsibilities

### 4.1 Storefront

The Storefront owns the customer-facing commerce experience.

Primary areas:

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

The Storefront uses SSR where appropriate for SEO-sensitive public pages.

### 4.2 Admin Portal

The Admin Portal owns internal commerce administration.

Primary areas:

```text
Dashboard
Catalog
Inventory
Orders
Payments
Users
```

The Admin Portal is CSR-oriented because its pages are authenticated and are not primarily SEO-driven.

---

## 5. Feature-Based Architecture

Business functionality is organized by feature rather than by technical layer.

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

A feature owns the code required to implement its business capability.

### Feature responsibilities

**Pages**
- Route-level components
- Page composition
- User interaction orchestration

**Components**
- Feature-specific presentation
- Feature-specific UI behavior

**Data Access**
- API services
- Server communication
- Mapping between API data and frontend needs

**State**
- Feature state
- Derived state
- Feature actions and effects where required

**Models**
- Feature-specific types and view models

Shared code must only be extracted when it is genuinely reusable.

As built in Phase 5 (see `docs/adr/012–014`), the Catalog feature is
the reference implementation: `apps/storefront/.../features/catalog/`
(pages, presentational components, `CatalogApiService` data access,
route-provided `CatalogState`, feature-owned models/i18n,
`catalogRoutes` lazy boundary) plus a sibling `features/home/` entry
page. Cross-feature needs travel through routes only — home imports no
catalog code and catalog imports no home/auth code. No shared catalog
library was created.

---

## 6. Shared Libraries

Shared libraries provide cross-feature infrastructure and reusable capabilities.

### `libs/api`

Responsible for:

- HTTP/API infrastructure
- API configuration
- Generated API types/client
- HTTP interceptors
- API error mapping
- Pagination abstractions
- Common API contracts

Business-specific API logic remains inside its owning feature.

### `libs/auth`

Responsible for:

- Authentication session
- Access token handling
- Refresh token lifecycle
- Authentication state
- Functional auth guards
- Role/authorization guards
- Authentication interceptor
- Current user/session management

As built in Phase 2 (see `docs/adr/001–004`), the library is organized
by capability:

```text
libs/auth/src/lib/
├── state/       # AuthSession/CurrentUser models, AuthService (sole writer)
├── session/     # TokenStorageService (+TOKEN_STORAGE), SessionRestoreService
├── tokens/      # ACCESS_TOKEN provider, TokenRefreshService, recovery provider
├── guards/      # authGuard, roleGuard
└── components/  # AuthNav shell widget
```

Applications compose it once at bootstrap (`provideAccessToken()`,
`provideAuthRecovery()`, `provideSessionRestore()` next to
`provideApi()`); the interceptor pipeline consumes it only through
provider seams, so `libs/api` never imports auth state.

### `libs/ui`

Contains reusable presentation components and design-system primitives,
as built in Phase 3 (Sub-Phases 3.4/3.5/3.10):

```text
Presentation  Button  Icon  Input  Badge  Card  Spinner  Alert  Divider  ThemeToggle
Layout        Container  Stack  Grid  Flex
Async states  LoadingIndicator  Skeleton  EmptyState  RetryButton  ErrorState
```

Every component lives in its own folder (`<name>.ts` / `.html` / `.css` /
`.spec.ts`); templates and styles are never inline. Components consume
theming tokens exclusively, import no `@flux/*` barrel, never touch
business features, HTTP, or the theme service, and hold no business-named
modules (closed set, enforced by ESLint boundaries and
`scripts/verify-architecture.mjs`). Components in this library must remain
business-agnostic.

### `libs/i18n`

Owns the localization and culture platform, as built in Phase 4
(Sub-Phases 4.1–4.8; see `docs/adr/009-localization-infrastructure.md`),
organized by capability under `libs/i18n/src/lib/`:

- `culture/` — `culture.ts` (`Culture`, `CultureMetadata`, the single
  `SUPPORTED_CULTURE_METADATA` registry (`en`/`fr`/`de`/`es`/`ar`,
  `ar` → `rtl`), `DEFAULT_CULTURE` (`en`), validation
  (`isSupportedCulture`/`parseCulture`/`resolveCulture`) and direction
  resolution — all pure and SSR-safe); `culture.service.ts`
  (`CultureService`: `culture`/`supportedCultures`/`initialized`/
  `direction` signals, persisted → browser → default precedence,
  guarded `localStorage` persistence, `setCulture` runtime switching,
  single-writer root `dir` application, `provideCulture()` bootstrap
  initializer — see `docs/adr/010-culture-direction-coupling.md`,
  `docs/adr/011-ssr-hydration-safety.md`); `culture-propagation.ts`
  (`provideCulturePropagation()` binds the Phase 1
  `ACTIVE_CULTURE_PROVIDER` seam to `CultureService`).
- `translations/` — `translation-model.ts` (nested-dictionary model,
  `namespace.group.key` convention), `translation-dictionaries.ts`
  (bundled base resources for all five cultures),
  `translations.ts` (synchronous loading, nested lookup,
  `{param}` interpolation, deterministic fallback target → `en` →
  key path).
- `formatting/` — `formatDate`/`formatNumber`/`formatCurrency` over
  `Intl` (`ar` renders Arabic-Indic digits via `ar-u-nu-arab`).
- `errors/` — `validation-errors.ts` (Angular `ValidationErrors` →
  `common.validation.*`); `error-localization.ts` (stable-code/status
  → `errors.*` with generic fallback).

Supported backend/frontend culture identifiers must remain consistent.
Feature libraries own feature-specific translation content; `libs/i18n`
never imports feature code, HTTP, or business domains.

### `libs/theming`

Owns the visual foundation, as built in Phase 3 (Sub-Phases 3.2/3.3):

- `tokens.css` — centralized `:root` custom properties (colors,
  typography, spacing, borders, radius, shadows, containers, z-index,
  motion, breakpoints); Dark overrides under `:root[data-theme='dark']`
  reuse the same names.
- `reset.css` — global border-box sizing and body-margin reset, wired
  before tokens in both apps.
- `ThemeService` — Light/Dark signal state, `data-theme` application,
  guarded `localStorage` persistence, `provideTheming()` bootstrap
  initializer (see `docs/adr/007-theme-service.md`).
- `theme.ts` — `Theme`, `isTheme`, `DEFAULT_THEME`, `THEME_ATTRIBUTE`,
  `THEME_STORAGE_KEY`.

Components consume variables; they never inject the service. Direction
switching is owned by Phase 4 (`CultureService` applies root `dir` from
the active culture; see `docs/adr/010-culture-direction-coupling.md`).

### `libs/models`

Contains only genuinely shared types that cross application/feature boundaries.

Feature-specific models should remain inside their feature.

### `libs/utils`

Contains generic utilities with no business ownership.

Avoid turning this library into a dumping ground.

---

## 7. Dependency Boundaries

Dependencies should flow toward shared infrastructure and remain explicit.

```text
Applications
    ↓
Features
    ↓
Shared Libraries
```

A feature should not directly depend on another unrelated feature's internal implementation.

For example:

```text
Catalog → Catalog Data Access
Cart    → Cart Data Access
Orders  → Orders Data Access
```

Instead of:

```text
Cart → Catalog internal service
Orders → Cart internal state
```

Cross-feature communication should use stable contracts, shared abstractions, or backend APIs where appropriate.

---

## 8. Component Architecture

All components are standalone components.

Components should be divided conceptually into:

### Smart / Container Components

Responsible for:

- Reading feature state
- Triggering actions
- Coordinating data
- Handling page-level behavior

### Presentational Components

Responsible for:

- Rendering data
- Emitting user interactions
- Reusable visual behavior

Presentational components should avoid direct API access.

Example:

```text
ProductListPage
    ↓
Catalog State / Facade
    ↓
ProductCard
```

`ProductCard` should not call the Catalog API.

### Component File Organization

Every shipped component lives in its own folder with one concern per file:

```text
libs/ui/src/lib/alert/
├── alert.ts        # decorator (templateUrl/styleUrl), class, public API
├── alert.html      # markup only
├── alert.css       # styles only
└── alert.spec.ts   # colocated component tests
```

The same structure applies project-wide: `libs/ui` primitives, `libs/auth`
widgets (e.g. `auth-nav/`), and application feature components (e.g.
`field-errors/`). The `.ts` file holds the decorator, the component class,
and its API documentation — never inline `template`/`styles` blocks.

Test-host components defined inside `*.spec.ts` files keep inline templates;
they are test-only scaffolding, not shipped components.

---

## 9. State Management

State is managed at the smallest appropriate scope.

### Local UI State

Use component signals for:

- Dialog visibility
- Selected tab
- Selected image
- Temporary form/UI state
- Expand/collapse state

### Feature State

Use Signals or a feature store for:

- Catalog filters
- Pagination
- Product selection
- Cart state
- Checkout state
- Order state

### Global State

Only globally relevant state should be global.

Examples:

```text
Authentication
Current User
Culture
Theme
Application Configuration
```

Do not place all server data into a global store.

### Complex State

Use SignalStore or NgRx only when the feature has meaningful state complexity, such as:

- Complex checkout workflows
- Multiple coordinated async operations
- Significant derived state
- Complex effects
- State that must be coordinated across multiple screens

As built in Phase 5 (see `docs/adr/012–013`), Catalog proves the
simple path suffices for discovery: route-provided `CatalogState`
(resource slots only, no `providedIn`) plus the pure, immutable
`CatalogQueryState` (typed search/category/filters/sort/page with
page-reset rules and one backend/route funnel). No global store, no
NgRx, no SignalStore — and data-access calls that read their own slot
must run `untracked` inside effects, or every settled response
reschedules the effect into an infinite fetch loop.

---

## 10. API Communication

The frontend communicates with the backend through a centralized API infrastructure.

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

Components should not contain scattered direct HTTP calls.

The API layer should provide:

- Strongly typed request/response contracts
- Authentication handling
- Error normalization
- Cancellation support
- Consistent request configuration

Backend API contracts are the source of truth for integration.

---

## 11. Authentication and Authorization

Authentication follows the backend JWT + refresh-token architecture.

Conceptual flow:

```text
Login
  ↓
Authenticated Session
  ↓
Access Token
  ↓
Authenticated API Requests
  ↓
Access Token Expiration
  ↓
Refresh Token
  ↓
Retry Request
```

Authentication responsibilities include:

- Login
- Registration
- Logout
- Session restoration
- Access-token management
- Refresh-token handling
- 401 handling
- Route protection
- Role-based route protection

As built in Phase 2:

- State is a tri-state signal model (`initializing | anonymous |
  authenticated`) with readonly selectors; `initialized` is the single
  readiness signal guards and shells await — `initializing` is never
  treated as anonymous.
- Token injection and 401 recovery live in the interceptor pipeline
  (recovery upstream of injection so retries re-enter Bearer attachment):
  single-flight refresh, login/register/refresh URL exclusion, at most
  one retry per request, original-error propagation on decline.
- `authGuard` redirects anonymous navigation to `/login?returnUrl=`;
  `roleGuard` reads `route.data['roles']` (OR semantics, strict claims,
  fail-closed) and redirects denials to `/forbidden`.
- Refresh tokens persist (versioned `localStorage` key, platform-guarded);
  access tokens stay in memory; passwords are never persisted. SSR always
  renders the anonymous/initializing shell and reconciles post-hydration.

Authorization must never rely only on hiding UI elements.

Backend authorization remains authoritative.

---

## 12. Error Handling

API errors are normalized centrally.

Expected conceptual flow:

```text
HTTP Error
    ↓
HTTP Interceptor
    ↓
Normalized API Error
    ↓
Stable Error Code
    ↓
Localized User Message
    ↓
UI
```

Frontend business logic must not depend on server-generated human-readable error text.

Stable error codes should be used when the UI needs to distinguish specific backend errors.

---

## 13. Resource State Pattern

Loading, success, empty, and error states are treated as a common frontend pattern rather than being independently reinvented by every feature.

Typical resource lifecycle:

```text
Idle
 ↓
Loading
 ↓
 ├── Success
 ├── Empty
 └── Error
```

Shared UI should provide consistent presentation for:

- Loading
- Skeleton/loading placeholders
- Empty results
- API errors
- Retry actions

Features remain responsible for deciding the appropriate state and behavior.

---

## 14. Pagination, Filtering and Sorting

Pagination must be implemented as a reusable API/UI pattern.

The frontend should consume the backend's documented pagination contract.

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

The exact contract must follow the backend API specification.

Pagination, filtering, and sorting should be represented as typed state rather than unstructured query-string manipulation throughout components.

As built in Phase 5: the wire carries only
`items/totalCount/pageNumber/pageSize` — `totalPages`/`hasNext` are
client-side derivations (`totalPagesOf`, never sent or stored). Pager
UI stays feature-owned (the shared-library module set is closed);
pager state renders from RESPONSE-effective values, and page moves
commit through the coherent query state so search/filter/sort survive
navigation.

---

## 15. Localization and RTL

Localization is a first-class architectural concern.

Supported cultures must use the same identifiers as the backend.

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
- Localized validation messages
- Localized API errors

### RTL

RTL is a design requirement from the beginning.

Components must use CSS logical properties where possible:

```css
margin-inline
padding-inline
inset-inline
border-inline
text-align: start
```

Avoid hard-coded directional properties such as:

```css
margin-left
margin-right
padding-left
padding-right
```

unless there is a specific reason.

Direction is controlled centrally rather than independently by features.

As built in Phase 3 (Sub-Phase 3.9, `docs/adr/008-rtl-first.md`): the
workspace is fully logical-property-only (audit-enforced across apps and
libs), components render identically under LTR/RTL (direction-invariance
suite), and no code branches on direction. As built in Phase 4
(Sub-Phases 4.1–4.4): cultures, translations, and formatting live in
`libs/i18n`, and `CultureService` is the single writer of document `dir`
(`ar` → `rtl`, else `ltr`; see
`docs/adr/009-localization-infrastructure.md` and
`docs/adr/010-culture-direction-coupling.md`).

---

## 16. Theming

The application uses CSS custom properties and design tokens.

Themes switch through the centralized `ThemeService`, which applies:

```html
<html data-theme="light">
```

Example conceptual tokens:

```css
--color-primary
--color-surface
--color-text
--color-border
--spacing-sm
--spacing-md
--radius-md
```

Components consume tokens rather than hard-coded theme values.

Switching persists to guarded `localStorage` and stays SSR-safe (server
renders the default shell; see `docs/adr/007-theme-service.md`). Both
themes meet WCAG AA text contrast (audit-enforced against the token
values).

The theme system supports:

```text
Light
Dark
```

Additional themes should be possible without rewriting feature components.

---

## 17. Responsive Design

The Storefront must support:

```text
Mobile
Tablet
Desktop
```

Responsive behavior belongs primarily to the UI/design system and feature components, not to separate application implementations.

Use responsive CSS and layout primitives instead of duplicating components for different screen sizes.

As built in Phase 3 (Sub-Phase 3.8): canonical breakpoints live in
`libs/theming` (`--breakpoint-sm/md/lg/xl`: 30/48/64/80rem) and media
queries repeat those values exactly (audit-enforced); display type and
container padding scale fluidly (`clamp()`); layout children can shrink
below content size. Zero horizontal overflow at 375/768/1280px is covered
by E2E.

---

## 18. Storefront Commerce Flow

The main customer journey is:

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

The frontend presents the workflow but does not orchestrate backend business workflows such as Order/Inventory/Payment Saga processing.

The backend remains responsible for business orchestration.

---

## 19. Cart Architecture

The cart must support both anonymous and authenticated users.

Required flow:

```text
Guest
  ↓
Guest Cart
  ↓
Login
  ↓
Cart Merge
  ↓
Authenticated Cart
```

Guest-to-authenticated cart merge is a required business scenario and must be tested.

The frontend must treat the cart as an API capability and must not depend on backend storage details such as Redis.

---

## 20. Checkout and Payment

Checkout and payment are separate concerns.

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
Payment Provider
  ↓
Payment Result
  ↓
Order Status
```

The frontend handles the user-facing payment experience.

Backend services remain responsible for:

- Payment verification
- Order state transitions
- Inventory coordination
- Webhooks
- Idempotency
- Saga/workflow processing

The frontend must not reproduce backend payment or order orchestration logic.

---

## 21. Product Architecture

Catalog/product UI should support:

- Categories
- Search
- Filtering
- Sorting
- Pagination
- Product cards
- Product details
- Product images
- Variants
- SKU
- Pricing
- Availability
- Specifications

Product presentation should consume API contracts rather than making assumptions about backend storage or implementation.

As built in Phase 5 (discovery only — details/variants/SKU/pricing/
availability arrive in Phase 6): the product card renders exactly what
`CatalogProductListItem` carries (image, name, details link) and
nothing it does not; price and availability were requested by example
text but do not exist in the catalog contract, so they are not
fabricated. Catalog copy is feature-owned per culture (catalog + home
namespaces); SSR renders idle shells with dynamic `Title`/`Meta`, and
settled list pages transfer server → client once per query
(`docs/adr/014`).

---

## 22. Testing Architecture

Testing begins with the first implementation phase.

### Unit / Component Tests

Use Vitest for:

- Services
- Stores
- State logic
- Utilities
- Validators
- Presentational components
- Feature behavior

### End-to-End Tests

Use Playwright for critical user journeys.

Initial critical flows include:

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

Admin E2E flows are added as the Admin Portal is implemented.

### Testing Principle

A feature is not considered complete when its implementation works only manually.

The expected lifecycle is:

```text
Implement
  ↓
Test
  ↓
Verify
  ↓
Acceptance Criteria
```

---

## 23. SSR Strategy

SSR is primarily used for Storefront pages where SEO and initial rendering provide value.

SEO-sensitive pages include:

- Home
- Category pages
- Product listing pages
- Product detail pages

Authenticated customer areas and the Admin Portal do not require the same SEO treatment.

SSR implementation must avoid browser-only APIs during server rendering and must correctly handle hydration.

---

## 24. Performance Principles

Performance is considered throughout development.

Primary principles:

- Lazy-load feature routes
- Avoid unnecessary global state
- Avoid unnecessary subscriptions
- Prefer Signals where appropriate
- Optimize images
- Minimize duplicate API requests
- Use appropriate caching
- Keep shared libraries focused
- Avoid unnecessarily large dependencies
- Preserve SSR/hydration performance
- Measure before optimizing

Performance optimization should be evidence-driven.

---

## 25. Security Principles

The frontend follows security practices appropriate to a browser application.

Important principles:

- Never trust frontend authorization
- Backend remains the security boundary
- Do not expose secrets in frontend configuration
- Validate user input
- Avoid unsafe HTML rendering
- Handle authentication tokens carefully
- Do not store sensitive information unnecessarily
- Protect authenticated routes
- Do not rely on hidden UI elements as authorization

Payment-sensitive operations must follow the payment provider's recommended browser integration model.

---

## 26. Development Workflow

Each feature should be developed as a vertical slice.

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

A feature should be considered complete only when the complete user-facing slice works.

---

## 27. Architectural Rules

The following rules should remain stable throughout development.

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

This document is the baseline architecture, not a reason to prevent justified evolution.

Architectural changes should be made when there is a concrete requirement, measurable complexity, or demonstrated limitation.

When a significant architectural decision changes:

1. Update this document.
2. Document the reason for the change.
3. Identify affected features.
4. Update implementation conventions where necessary.
5. Keep the architecture and actual code synchronized.

The goal is a maintainable Angular 22 enterprise frontend, not architectural complexity for its own sake.
