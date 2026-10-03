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

As built in Phase 12 (see
`docs/completed/PHASE_12_COMPLETION_REPORT.md`): the portal is a
guarded eager shell (`AppLayout` with sidebar, header, main outlet,
and the notification host) over lazy routes — public `/login` and
`/forbidden` outside the shell, `Admin`/`SuperAdmin`-guarded nested
features inside — with its own login page, dashboard foundation, and
admin-owned shared primitives. No business features exist yet.

As built in Phase 13 (see
`docs/completed/PHASE_13_COMPLETION_REPORT.md` and
`docs/adr/027–028`): the Catalog and Inventory areas are real
business features — products (list/create/edit/details/lifecycle),
variants (list/details/create/edit/delete), categories
(list/details/create/edit/lifecycle over the flat parent model),
images and specifications (inline management on product details:
add/edit/delete, set-primary, reorder), stock (single-SKU lookup),
reservations (single-id lookup), and adjustments (additive form +
confirm + backend-returned result) — all under the guarded shell
with nested sidebar destinations, all against the real backend
contracts with contract-honest omissions (no invented lists,
searches, sorts, uploads, thresholds, or lifecycles).

As built in Phase 14 (see
`docs/completed/PHASE_14_COMPLETION_REPORT.md` and
`docs/adr/029–030`): the Orders area is a real business feature —
landing (backend-issued total), paged caller-owned list (no
platform-wide admin list exists), details (verbatim facts, line
items, address-backed customer information), and the payment section
(by-order chain into the single payment read, secret discarded,
status-first failures) — all under the guarded shell with sidebar
destinations, all against the real backend contracts with
contract-honest omissions (no invented filters, sorts, history,
linkage, mutations, or failure reasons).

As built in Supplement S1 (see
`docs/completed/SUPPLEMENT_S1_COMPLETION_REPORT.md` and
`docs/adr/031–032`): the portal adds permission-gated business
surfaces without changing the shell shape — users management
(`SuperAdmin`-only list/counts/details/grant/revoke), inventory
lists (paged stock + reservations with filters, counts cards,
single-lookup pages kept as deep-link targets), platform-wide orders
(list with filters, real counts, force-cancel, refund), payments
(platform-wide list with filters, stats, unscoped details —
read-only, no history, no mutations), and a live dashboard
(`GET /admin/dashboard` snapshot with per-module cards plus the
newest-5 drill-down). Guards stay UX-only (`permissionGuard` over
`route.data['permissions']`, OR semantics, `SuperAdmin` bypass);
the backend stays authoritative.

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

As built in Phase 6 (see `docs/adr/015–017`), Product Details extends
the same pattern to a deeper vertical slice:
`apps/storefront/.../features/product-details/` (foundation page,
gallery/selector/commercial/quantity/add-to-cart presentational
components, `ProductDetailsApiService` data access over catalog AND
cart endpoint tables, route-provided `ProductDetailsState` with
resource slots plus selection/orderability/quantity/submission
signals, feature-owned models/i18n, `productDetailsRoutes` lazy
boundary mounted at `catalog/products`, `RenderMode.Server`). The
gallery's selected image stays component-local UI state; the state
holds the image resource only. No shared product library was created,
and no cart state exists — the `CartResponse` envelope is
status-mapped only.

As built in Phases 7–8 (see `docs/adr/018–020` and
`docs/completed/PHASE_7_COMPLETION_REPORT.md` /
`PHASE_8_COMPLETION_REPORT.md`), Cart and Checkout prove the pattern
holds across feature boundaries without shared business libraries:
`apps/storefront/.../features/cart/` owns the cart slot, identity
lifecycle, and merge transport, while
`apps/storefront/.../features/checkout/` owns contracts
(`CreateOrderRequest`/`CreateOrderResponse` aliases over
`@flux/models`, never re-declared), forms, `CheckoutApiService`
(`POST /orders/checkout` + `Idempotency-Key` context transport),
route-provided `CheckoutState`, feature-owned models/i18n, and the
`checkoutRoutes` lazy boundary mounted at `checkout`. Checkout
consumes the cart read-only through the product-details seam style —
route-provided `CartState` plus the session lifecycle, snapshot-only
(`cartId`/`version`/line count, never lines or prices) — so no second
cart store exists and no cycle is possible. Contract gaps stay
honest: no email/phone/method controls exist because the wire carries
none, and money renders backend-issued or not at all.

As built in Phase 9 (see `docs/adr/021–022` and
`docs/completed/PHASE_9_COMPLETION_REPORT.md`), Payments extends the
pattern across the provider boundary without shared business
libraries: `apps/storefront/.../features/payments/` owns the guarded
8-stage lifecycle (`PaymentState`, route-provided), the thin
`PaymentApiService` (real status/order reads, contract-blocked
init/confirm short-circuits — no fabricated endpoints), the
`PaymentProvider` abstraction with the token-bound
`StripePaymentProvider` behind it (no npm Stripe dependency, no SDK
shapes outside the adapter), feature-owned models/i18n, and the
`paymentsRoutes` lazy boundary mounted at `payment`. Backend gaps
stay honest: initialization and confirmation cannot execute until
the backend lands the intent path, so both short-circuit with a
normalized, branchable error instead of hallucinating traffic.

As built in Phase 10 (see
`docs/completed/PHASE_10_COMPLETION_REPORT.md`), Orders extends the
pattern across the whole post-purchase area without shared business
libraries: `apps/storefront/.../features/orders/` owns the
`accountRoutes` lazy boundary mounted at `account` (guarded shell
with route-provided `AccountState` over `GET /auth/me`, profile page
with loading/error/loaded states, read-only by contract), the
`ordersRoutes` sub-boundary (`OrdersListPage` with route-provided
`OrdersListState` over the paged `GET /orders` contract;
`OrderDetailsPage` with route-provided `OrderDetailsState` over
`GET /orders/{orderId}` plus the bounded `timer` + `take` +
`exhaustMap` post-payment sync loop), feature-owned
order/payment status badges with independent localized mappings and
unknown-value fallbacks, and feature-owned models/i18n. Backend gaps
stay honest: no order-history timeline exists (no history contract —
`ORDERS_HISTORY_SUPPORTED` pins the gap), no per-order payment
status renders (no payment fields on any order payload), no tax rows
or thumbnails render (no such contract fields), and no totals math
or status derivation exists anywhere (backend values render
verbatim).

As built in Phase 11 (see
`docs/completed/PHASE_11_COMPLETION_REPORT.md` and `docs/adr/025`),
no business features were added or moved: the shell gained only
app-owned chrome (dumb `StorefrontCultureSwitch`, label-input
`AuthNav`, destination tables composed outside the layout boundary,
router-event pending/failure states in `AppLayout`) and the
layout/auth translation bundles. Feature boundaries are unchanged.

As built in Phase 12 (see
`docs/completed/PHASE_12_COMPLETION_REPORT.md` and `docs/adr/026`),
admin reusable UI lives as **admin-app-owned shared components**
(`apps/admin/src/app/shared/`: data-table, pagination, filters,
forms, dialog, notifications) rather than in `libs/ui` (whose module
set stays audit-pinned closed) or in features (Phases 13–14 share
them). They follow the same dumb-component rules as `libs/ui`
(inputs in, events out, token-only logical CSS, no business
knowledge, no HTTP) while composing shared infrastructure
(`PagedResult`/`totalPagesOf`, async UI, i18n resolvers).

As built in Phase 13 (see `docs/adr/028`): the shared table grew by
extension, never by fork — per-column row links (deep-linkable
anchors) plus a projected row-actions column (`actionsTemplate`
with `$implicit: row` plus `index`, owner-localized header). Both
are business-free and spec-pinned; features pass templates while
the table reserves the cell.

As built in Phase 14 (see `docs/adr/030`): the shared table grew by
the same sanctioned pattern a third time — per-column cell templates
(`column.template` with `$implicit: row` plus `index`, e.g. a status
badge). Business-free and spec-pinned; testing the extension caught
a real defect (the outlet context carried the column-loop `$index`,
fixed by aliasing the row index).

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

As built in Phase 6 (see `docs/adr/015–017`), the same shape scales to
selection and purchase intent without new machinery: route-provided
`ProductDetailsState` owns four resource slots plus a validated
selection id, derived selection/orderability projections, a validated
quantity, and a submission machine projected from one more resource
slot — all plain signals and computeds, still no `providedIn`, still
no global store. Route-param effects keep the `untracked` +
per-run-`AbortController` discipline and additionally clear
selection/quantity/feedback on product change (retry preserves them).

As built in Phases 7–8 (see `docs/completed/PHASE_7_COMPLETION_REPORT.md`
/ `PHASE_8_COMPLETION_REPORT.md`), the same shape also covers
multi-slot workflows without new machinery: route-provided
`CartState` (one cart resource slot plus identity plus active
operation, pessimistic one-at-a-time lock) and route-provided
`CheckoutState` (one order-creation resource slot plus plain form
data, cart snapshot, initialization, and key-tracking signals, with
the `initial → loading → ready → submitting → success | failure`
workflow derived — never set). The two states stay isolated by
construction: checkout holds no cart lines and cart holds no checkout
data; the page bridges them through explicit seams (`initialize`,
`setFormData`, `submitOrder`/`retrySubmission`) with `untracked`
effects, and failure locks (`clearSubmissionError` for the edit path,
same-key `retrySubmission` for transport retries) keep every
re-attempt explicit.

As built in Phase 9 (see `docs/adr/021–022` and
`docs/completed/PHASE_9_COMPLETION_REPORT.md`), the same shape also
covers provider-mediated workflows without new machinery:
route-provided `PaymentState` (lifecycle + intent context + backend
facts + order display slots, all plain signals and computeds, still
no `providedIn`, still no global store). The lifecycle is a
table-driven machine (`canTransitionPaymentLifecycle` fails closed;
every action returns acceptance), the provider is driven around the
state — never inside it — and backend verdicts override provider
claims through explicit edges (`pending → cancelled`,
`succeeded → failed/cancelled`), so client-side confirmation can
never present as final proof.

As built in Phase 12 (see
`docs/completed/PHASE_12_COMPLETION_REPORT.md`), the admin side adds
no state machinery: shell chrome derives from signals and computeds
(drawer visibility, localized destinations, copy), pages hold plain
form/request signals, and the only root-provided admin services are
the notification center (cross-feature toasts by design) and the
stateless login orchestration. No NgRx, no SignalStore, no global
admin store — pinned by dedicated audit guards.

As built in Phase 13 (see `docs/adr/028`): catalog and inventory
state follows the same shape — route-provided `@Injectable()`
services and `createResourceState` slots (overview, product/category/
variant lists, details slots, stock/reservation lookups), explicit
`load*` calls with `untracked` route-param effects and
supersede-or-lock concurrency, envelopes unwrapped in state,
dataless envelopes as contract violations. Adjustment submission
stays page-local. The 12.8 root-provided allowlist is unchanged.

As built in Phase 14 (see `docs/adr/030`): orders and payment state
follows the same shape — route-provided `@Injectable()` services and
`createResourceState` slots (overview, paged list with committed
page moves, single order details, chained by-order → payment read),
explicit `load*` calls with `untracked` route-param effects and
supersede concurrency, envelopes unwrapped in state, dataless
envelopes as contract violations. The payment slot stays
independent (its failures never hide settled order facts) and the
creation/adjustment submissions stay page-local. The 12.8
root-provided allowlist is unchanged.

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

As built in Phase 12: the Admin Portal reuses this exact
infrastructure with no separate auth system — its own login page
drives the same login → session → profile flow, the shell guard
chain admits only `Admin`/`SuperAdmin` (roles spread from the single
`ADMIN_PORTAL_ROLES` source), and denials land on its own localized
`/forbidden` page.

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

As built in Phase 11 (see `docs/adr/024–025`):

- Public SEO/social metadata is page-owned (`title`/`description`/
  canonical/`og:*`/`twitter:card`) with app-relative URLs, shared
  idempotent helpers in `libs/utils`, and honest error-state fallbacks
  (listing canonical, fallback image, `noindex` on route 404s). Private
  pages expose no description, canonical, or social tags.
- Shell chrome is localized through the app-owned `layout.*` bundle
  (destinations as `{labelKey, route}` pairs composed outside the
  layout boundary); auth pages through the feature-owned `auth.*`
  bundle; validation and form-level failures through the Phase 4
  platform resolvers. The dumb `StorefrontCultureSwitch` and label-input
  `AuthNav` keep shells wired without coupling `libs/auth` to i18n.

---

## 16. Theming

The application uses CSS custom properties and design tokens.

Themes switch through the centralized `ThemeService`, which applies:

```html
<html data-theme="light"></html>
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

As built in Phase 8 (see
`docs/completed/PHASE_8_COMPLETION_REPORT.md`), the checkout side is
complete: the `/checkout` lazy route (auth-guarded) serves the
`CheckoutPage`, which composes the typed address form, the
backend-facts-only order summary, and the `createOrder` submission
against the snapshotted cart — storing the created order verbatim as
the Phase 9 handoff.

As built in Phase 9 (see
`docs/completed/PHASE_9_COMPLETION_REPORT.md` and
`docs/adr/021–022`), the payment side is complete: the `payment`
lazy boundary serves `PaymentPage` (`/payment/:orderId` — live flow:
init, provider setup, confirmation, outcome routing) and
`PaymentResultPage` (`/payment/:orderId/result` — outcome hub with
backend verification), driven by the route-provided `PaymentState`
(guarded 8-stage lifecycle, `Initialized ≠ Succeeded`, backend-truth
overrides), the thin `PaymentApiService` (real status read plus
contract-blocked init/confirm short-circuits — no fabricated
endpoints), and the isolated `PaymentProvider`/`StripePaymentProvider`
boundary (no npm Stripe dependency, platform-guarded browser touches,
publishable key + script URL from app environments). Checkout links
into payment via `Continue to payment`; order polling belongs to
Phase 10 — complete (see
`docs/completed/PHASE_10_COMPLETION_REPORT.md`): the `account`
boundary serves the profile, the paged orders list, and the order
details with its bounded post-payment sync loop, and the payment
result links onward to the customer order.

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

As built in Phase 6 and unblocked by the priced-variant contract change
(see `docs/adr/016–018`): the details page renders exactly what the
contracts carry — name, description, specifications, images
(`displayOrder`), and the flat variant list (name/selectability) with
SKU and the backend-issued unit price bound live to the selection
(price formatted per culture, display only — never an input to math;
availability still renders nowhere, inventory reads stay `Admin`-only).
The selected variant is the source of truth for variant-specific data;
submission projects the snapshot through the validated
`toAddToCartPricing` helper (display and wire body can never disagree)
and submits guest lines through the existing machine + façade, with the
guest `cartId` lifecycle borrowed from the cart feature's
`GuestCartService` seam (one-way, no cycle) and dead-identity healing
for the next attempt. The button mounts beside the quantity section,
gated on selectable variant + valid pricing + established guest
identity. Authenticated submission stays parked for Phase 7.6 auth
branching (the page never inspects auth state).
Product copy is feature-owned per culture (`productDetails`
namespace); SSR fetches live at request time (`RenderMode.Server`,
never prerendered) with dynamic `Title`/`Meta`/OpenGraph per
resource state, and settled slots transfer server → client once per
id.

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

As built in Phase 12: admin access-control journeys (anonymous →
login, customer → forbidden, Admin/SuperAdmin → dashboard, refresh,
expiry, logout) plus integrated journeys (login form flow, sidebar
navigation with active state, deep links, mobile drawer, French
chrome, RTL switch, theme persistence) run mocked-transport green;
shared primitives gain E2E integration coverage as Phases 13–14
mount them on real pages.

As built in Phase 13: thirteen admin catalog/inventory journeys
(product list/create/edit, variants, categories plus soft-delete,
images/specs, unknown-product error, stock and reservation lookups,
adjustment with updated-state verification, customer→forbidden,
French chrome) run mocked-transport green in
`e2e/admin-catalog.spec.ts`; the pre-existing admin suites were
re-verified green with the extended navigation.

As built in Phase 14: fifteen admin orders journeys (landing, list
with pager and details navigation, response-effective pagination,
empty/error/retry paths, unknown-order error, details
facts/addresses/items, payment facts, failed-payment status,
missing-payment empty, unready-payment retry recovery,
customer→forbidden, French chrome, RTL chrome) run
mocked-transport green in `e2e/admin-orders.spec.ts` (new
`admin-orders-chromium` project); the pre-existing admin suites were
re-verified green with the extended navigation.

As built in Supplement S1 (see
`docs/completed/SUPPLEMENT_S1_COMPLETION_REPORT.md`): new suites run
mocked-transport green alongside extended pre-existing ones —
`admin-users` (list/counts/details/grant/revoke, French + RTL
chrome), extended `admin-orders` (platform-wide list with filters,
counts, force-cancel, refund), `admin-payments` (stats, list with
filters, details, failed status, French + RTL chrome),
`payments-mine` (customer list with status filter, French + RTL
unit/E2E chrome), `admin-dashboard` (live counts, drill-down,
French + RTL chrome), inventory lists (stock/reservation lists with
filters, French + RTL chrome), and profile editing; S1.11 added
RTL unit coverage (users/inventory/profile/variant pages) and RTL
E2E for users and inventory lists. Pre-existing suites re-verified
green with the extended navigation.

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

As built in Phase 11 (see `docs/adr/023`):

- The 15 static routes are declared explicitly as `RenderMode.Prerender`
  (data-driven `:id` routes stay `RenderMode.Server`); the `**`
  catch-all stays `RenderMode.Server` so unknown URLs render the
  localized, non-indexable `NotFoundPage` through the pipeline instead
  of a raw framework page. (A `Server` wildcard disables crawl-based
  discovery, hence the explicit list — pinned at 15/15 by rebuild.)
- `server.ts` guards `/api/*` with a generic JSON 404 (no same-origin
  proxy exists) and serves one static, internals-free page for
  terminal fallthrough (404) and unexpected failures (500, logged
  server-side).
- Host validation is deployment configuration (`allowedHosts: []`
  deny-by-default; `NG_ALLOWED_HOSTS` at runtime).
- Unknown URLs return HTTP 200 with `noindex`: Angular SSR exposes no
  status-code seam for `**` routes (Phase 15 item).

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

As built in Phase 11 (§11.7): initial ~361 kB raw / ~100 kB transfer
(inside budgets), largest lazy chunks 25–41 kB, 74/74 components
`OnPush`, no duplicate-request paths (untracked effects, single-use
`TransferState`, single-flight lifecycles). The single change was
splitting payment-only Stripe constants into a lazy
`stripe-environment` module (plus `fileReplacements`) after chunk
analysis proved them initial-bundle residents. No new
state-management, caching, or architectural abstractions were
introduced.

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

As built in Phase 11 (§11.12): bundle scanned secret-free, env files
public-only, access token memory-only, `Authorization` scoped to
backend URLs in the interceptor (absolute third-party URLs never
receive it), zero `innerHTML`/sanitizer bypasses, anonymous SSR
shells, code-resolved localized errors app-wide, generic server
failure pages. Guards remain UX protection only; backend authorization
stays authoritative.

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
