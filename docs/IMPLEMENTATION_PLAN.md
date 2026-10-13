# FluxCommerce Frontend — Implementation Plan

> Consolidated record of every implementation phase, sub-phase, and
> verification outcome. This file replaces the retired per-phase plan
> files (`docs/phases/*`) and completion reports (`docs/completed/*`),
> which were removed after consolidation. Code docblocks may still cite
> the old `docs/phases/*` paths as historical provenance.
>
> Living references: `docs/PROJECT_CONTEXT.md` (master state),
> `docs/ARCHITECTURE.md` (rules), `docs/DESIGN.md` (visual system),
> `docs/frontend-contract/` (API truth), `docs/adr/` (decisions).

Conventions applied to every phase: vertical-slice delivery
(requirement → contract → data access → state → UI → page → resource
states → localization/RTL → tests → acceptance), backend contracts as
source of truth, no fabricated endpoints/DTOs/rules, 5-culture
localization with RTL-safe rendering, and the Definition of Done
(work against the real contract, routing/lazy loading, loading/empty/
error states, responsive + accessible + tested, no cross-feature
coupling, no backend logic moved to the frontend).

Status legend: ✅ Complete · ⏳ Open.

---

## Phase 0 — Frontend Foundation + Testing ✅ Complete (2026-09-05)

Objective: stable, testable Angular 22 standalone baseline (Storefront SSR + Admin CSR + shared libs + testing/CI) with no business features.

- 0.1 Angular Workspace Initialization — clean Angular 22 strict standalone baseline.
- 0.2 Multi-Application Workspace — `apps/storefront` + `apps/admin` with independent build/serve targets.
- 0.3 Shared Libraries Foundation — `libs/api, auth, ui, i18n, theming, models, utils` with barrel APIs.
- 0.4 Application Architecture & Dependency Boundaries — Apps → Features → Libs direction and public entry points.
- 0.5 Application Shell & Routing Foundation — standalone routing, lazy-loading conventions, shells, 404.
- 0.6 Storefront SSR Foundation — Storefront SSR + hydration; Admin CSR-only.
- 0.7 Environment & Application Configuration — typed dev/prod config, centralized `apiBaseUrl`, no secrets.
- 0.8 Testing Foundation — Vitest unit/component + Playwright smoke suites.
- 0.9 CI Testing Foundation — install → build → unit → E2E smoke pipeline, fail-fast.
- 0.10 Architectural Verification — workspace, standalone, SSR/CSR, routing, testing boundaries.
- 0.11 Foundation Quality & Cleanup — remove demo/dead deps, audit naming/imports/configs/builds/tests.
- 0.12 Phase Completion & Documentation — verification checklist, test/arch records, completion report, context sync.

Deliverables: Storefront (SSR + hydration, :4200) + Admin (CSR, :4201); 7 libs with `@flux/*` mappings and ESLint boundaries; `verify-architecture` 25/25; 13/13 unit + 6/6 E2E smoke green. Toolchain: Angular CLI 22.1.7, TS 6.0.3, Vitest 4.0.8, Playwright 1.62.1.

---

## Phase 1 — Core Infrastructure ✅ Complete (2026-09-05)

Objective: shared typed frontend ↔ backend communication infrastructure on top of `docs/frontend-contract/`.

- 1.1 API Contract Integration Foundation — Angular consumption strategy for the contract docs (no duplication/codegen).
- 1.2 HttpClient & API Configuration — central `provideApi()` + `API_BASE_URL` from `APP_ENVIRONMENT`, no hard-coded URLs.
- 1.3 Typed API Client Architecture — reusable `ApiClient` (verbs, path/query typing); Feature → ApiClient → HttpClient.
- 1.4 HTTP Interceptor Pipeline — ordered functional pipeline (correlation → request-config → auth hook → error hook).
- 1.5 API Error Normalization — `ApiError` (status/code/message/validationErrors/correlationId/traceId), code-over-message rule.
- 1.6 Correlation & Request Context — `X-Correlation-ID` ownership/echo for traceability.
- 1.7 Request Cancellation & Lifecycle — abort signals, silent aborts, race replacement.
- 1.8 Query Parameters & Pagination Abstractions — `PaginationRequest`/`normalizePagination`, `SortQuery`, wire-identical serializers.
- 1.9 Resource State Architecture — signal `ResourceState<T>` (idle/loading/success/empty/error), no global store.
- 1.10 Common Async UI States — `libs/ui` async primitives (LoadingIndicator, Skeleton, EmptyState, ErrorState, RetryButton).
- 1.11 Real Backend Integration Slice — minimal `GET /catalog/products` vertical slice against contract-exact mocks.
- 1.12 Testing & Architectural Verification — unit/HTTP/integration coverage; direct `HttpClient` banned in features.
- 1.13 Phase Hardening & Documentation — SSR/compat/security review, full verification, doc sync.

Deliverables: enforced layering (lint + script, negative-tested); `verify-architecture` 29/29; 126/126 unit; E2E smoke retained; HTTP 400/401/404/409/500/network/cancel covered.

---

## Phase 2 — Identity & Authentication ✅ Complete (2026-09-09)

Objective: first-class auth platform — register/login/logout, session + token lifecycle, 401 recovery, guards, SSR-safe UI.

- 2.1 Identity Contract Integration — typed `IdentityApiService` (register/login/refresh/logout/me/verify/resend/forgot/reset/change).
- 2.2 Authentication State & Session Foundation — `AuthService` tri-state (`initializing | anonymous | authenticated`) + selectors, signals only.
- 2.3 Token Storage & Session Model — versioned persisted refresh + user snapshot; access JWT memory-only; SSR-safe.
- 2.4 Login & Registration — `features/auth` slice, contract-mirroring forms, `/login` + `/register`; never auto-login on register.
- 2.5 Access Token Integration — `provideAccessToken()` Bearer injection in both apps.
- 2.6 Refresh Token Lifecycle — single-flight rotation, loop prevention.
- 2.7 Centralized 401 Recovery — eligible-401s-only interceptor, one retry, auth endpoints excluded.
- 2.8 Session Restoration & Current User — non-blocking initializer (refresh → `GET /auth/me`); `initialized` as guard primitive.
- 2.9 Logout & Session Cleanup — backend revoke + total local cleanup, never throws.
- 2.10 Email Verification & Password Recovery — `/verify-email`, `/resend-verification`, `/forgot-password` (anti-enumeration), `/reset-password`; no session establishment.
- 2.11 Authentication Guards — `authGuard` (anonymous → `/login?returnUrl=`).
- 2.12 Role Guards & Admin Foundation — `roleGuard` (OR, strict claims, fail-closed → `/forbidden`) + guarded admin stub.
- 2.13 Authentication UI Integration — shared `AuthNav` widget in both shells.
- 2.14 Testing & Security Verification — state/token/guard/refresh unit + HTTP pipeline + mocked-transport E2E + secret hygiene.
- 2.15 SSR, Security & Production Verification — anonymous SSR, hydration, no token logging, single Bearer site, race checks.
- 2.16 Documentation & Phase Completion — context/architecture/ADR sync + completion report.

Deliverables: full auth stack + ADRs 001–004; 268/268 unit; auth E2E 10/10 (mocked transports); SSR/hydration audit clean; architecture 29/29.

---

## Phase 3 — UI System + Theming + RTL Foundation ✅ Complete (2026-09-10)

Objective: scalable theme-aware RTL-safe responsive presentation foundation — no business UI, no full i18n.

- 3.1 UI Architecture Foundation — `libs/ui` (presentation) vs `libs/theming` (visual infra) vs app composition; business-agnostic rules.
- 3.2 Design Tokens & CSS Variables — centralized `:root` tokens (color, type, spacing, borders, radius, shadows, containers, z-index, motion).
- 3.3 Theme System — `ThemeService` Light/Dark + `data-theme`, guarded persistence, SSR-safe; components consume variables only.
- 3.4 Core UI Primitives — Button, Icon, Input, Badge, Card, Spinner, Alert, Divider (speculative controls deferred).
- 3.5 Layout Primitives — Container, Stack, Grid, Flex.
- 3.6 Storefront Application Shell — header, navigation, footer, layout composer; auth reused, no business features.
- 3.7 Admin Application Shell — sidebar, header, layout composer; no business modules.
- 3.8 Responsive Foundation — canonical breakpoints as tokens (30/48/64/80rem), fluid type/padding, single responsive components.
- 3.9 RTL Foundation — logical-properties-only workspace; direction switching deferred to Phase 4.
- 3.10 Navigation & Shared Shell Components — only `ThemeToggle` promoted to `libs/ui` (closed 19-module set).
- 3.11 Accessibility & UX Hardening — semantics, keyboard, focus rings, Escape + focus return, computed AA contrast.
- 3.12 Testing & Architectural Verification — direction-invariance suite + E2E theme/viewport/RTL matrix + boundary checks.
- 3.13 Documentation & Phase Completion — conventions + completion report.

Deliverables: `libs/ui` (19 modules, zero `@flux/*` imports) + `libs/theming`; audit 97/97; 350 unit tests; E2E theme/viewport/RTL green; ADRs 005–008.

---

## Phase 4 — Localization & Culture Management ✅ Complete (2026-09-10)

Objective: centralized localization and culture-management infrastructure.

- 4.1 Culture Model & Supported Cultures — registry for `en/fr/de/es/ar` (`ar → rtl`) + validation.
- 4.2 Translation Resource System — runtime loading, lookup, interpolation, deterministic fallback.
- 4.3 Culture State & Language Switching — `CultureService` signals, switching, persistence, SSR-safe init.
- 4.4 Localization & Direction Integration — culture → direction mechanism, no duplicate direction state.
- 4.5 Backend Culture Synchronization — `Accept-Language` propagation via request context.
- 4.6 Formatting & Localized Validation — culture-aware date/number/currency + localized validation messages.
- 4.7 API Error Localization — normalized error codes → localized messages with fallback.
- 4.8 SSR, Hydration & End-to-End Validation — culture/direction/formatting consistency across SSR, hydration, switching, reloads.

Deliverables: `libs/i18n` platform + `ACTIVE_CULTURE_PROVIDER` seam + `e2e/culture.spec.ts`; 352 lib tests; full E2E 40 passed; audit 97/97. Arabic-Indic digits via `ar-u-nu-arab`; server stays direction-neutral.

---

## Phase 5 — Catalog & Product Discovery ✅ Complete (2026-09-12)

Objective: first complete customer-facing commerce capability — home, categories, product listing with search/filter/sort/pagination.

- 5.1 Catalog Feature Foundation — feature structure, models, data access, lazy routes, local state.
- 5.2 Home & Category Discovery — home entry, category list/navigation with resource states.
- 5.3 Product Listing — header, result count, reusable `ProductCard` + responsive grid (no variants/cart).
- 5.4 Catalog Query State — single typed immutable query state with reset rules and one backend/route funnel.
- 5.5 Search — backend-driven search (300ms debounce, stale cancellation, empty handling).
- 5.6 Filtering & Sorting — strictly backend-supported enums with active state + clear-all.
- 5.7 Pagination Integration — shared pagination infrastructure, query-preserving page moves.
- 5.8 Resource States & UX — differentiated Idle/Loading/Success/Empty/Error + retry.
- 5.9 Localization, RTL & Responsive Integration — 5-culture copy, RTL verification, viewports.
- 5.10 SSR & SEO Integration — TransferState hydration, dynamic Title/Meta/OG, no duplicate fetches.
- 5.11 Testing — unit/component/integration/E2E for state, UI, contract path, journey.
- 5.12 Hardening & Phase Completion — vertical-slice audit + docs.

Deliverables: `features/catalog/` + `features/home/` + `e2e/catalog.spec.ts`; 230 storefront tests; E2E 50 passed; 8 prerendered routes. Boundary: discover/browse only — price/availability refused (absent from list contract).

---

## Phase 6 — Product Details & Variants ✅ Complete (2026-09-12)

Objective: make the discoverable product inspectable, configurable (variant/quantity), and addable to cart.

- 6.1 Product Details Foundation — `/catalog/products/:id` lazy route, models, data access, feature-local state.
- 6.2 Product Details Page & Information — name/description/specs with Loading/Success/Error/Not Found.
- 6.3 Product Image Gallery — responsive accessible gallery with fallback, keyboard, RTL-safe.
- 6.4 Variant Selection — selected variant as source of truth; no invented dimensions.
- 6.5 SKU, Pricing & Availability — live SKU + backend-issued price binding; availability not fabricated.
- 6.6 Quantity Selection — validated quantity control with localized a11y labels.
- 6.7 Add to Cart Integration — cart-boundary submission with locks (no cart page/state owned here).
- 6.8 Localization, RTL, Responsive & Accessibility — 5-culture actions/messages, RTL, keyboard/focus.
- 6.9 SSR & SEO Integration — per-URL SSR/hydration with product metadata + Not Found handling.
- 6.10 Testing — state/gallery/variants/quantity/boundary unit + component + integration + E2E.
- 6.11 Hardening & Phase Completion — vertical-slice checklist + docs.

Deliverables: `features/product-details/` (6 components, priced-variant contract via ADR-018); 418 storefront tests; E2E 57 passed. Decisions in ADRs 012–018.

---

## Phase 7 — Shopping Cart ✅ Complete (2026-09-16)

Objective: complete cart for guest + authenticated users with backend-authoritative totals and mandatory merge coverage.

- 7.1 Cart Contracts & Feature Foundation — Cart/CartItem/CartTotals models, guest vs authenticated distinction.
- 7.2 Cart API & Data Access — Get/Add/Update/Remove/Clear/Merge data access (13 endpoints), no business logic.
- 7.3 Cart Feature State — route-provided `CartState` with pessimistic lock; server/UI separation.
- 7.4 Cart Page & UI — CartPage/Items/Item/Summary, quantity controls, totals display, checkout navigation only.
- 7.5 Guest Cart — contract-identity guest experience with expiration handling; no independent persistence.
- 7.6 Authenticated Cart — session-integrated cart with post-auth load and refresh retention.
- 7.7 Guest → Login → Cart Merge — atomic merge on auth transition (duplicate-safe, failure-handled).
- 7.8 UX States, Localization & Responsive Behavior — all resource states, 5-locale i18n, RTL, viewports, a11y.
- 7.9 Testing & Phase Verification — incl. mandatory Guest-Login-Merge E2E journey.

Deliverables: full cart slice + `e2e/cart.spec.ts` (11 tests) + `verify-phase-7.mjs` 8/8; 1039 unit tests; E2E 68 passed. Merge body exact; 2+3=5 duplicate consolidation proven.

---

## Phase 8 — Checkout ✅ Complete (2026-09-17)

Objective: checkout flow on the Phase 7 cart — data entry, validation, Create Order — without backend orchestration.

- 8.1 Checkout Architecture & Contract — contract review; Cart/Checkout/Submission boundaries.
- 8.2 Checkout Feature & Data Access — lazy auth-guarded feature + `CheckoutApiService` (`POST /orders/checkout` + `Idempotency-Key`).
- 8.3 Checkout State Management — Initial/Loading/Ready/Submitting/Success/Failure without duplicating Cart; duplicate-submit prevention.
- 8.4 Customer & Shipping Information — typed Reactive address forms mirroring the contract.
- 8.5 Order Summary — cart-derived review (no pricing logic recreated).
- 8.6 Client Validation & Create Order — validate, transform, submit, hand off to payments.
- 8.7 Failure Handling & Recovery — retry/edit/cart recovery mapping.
- 8.8 Localization, RTL, Responsive & Accessibility — full coverage incl. focus management.
- 8.9 Unit & Component Testing — forms, state, data access, components.
- 8.10 Checkout E2E & Integration Verification — authenticated cart-to-order journey + edge scenarios.

Deliverables: lazy `checkout` slice (188 tests across 14 suites); 1244 unit tests; checkout E2E 12/12; audit 97/97. No payment/Stripe/polling logic.

---

## Phase 9 — Payments ✅ Complete (2026-09-19)

Objective: payment UX (backend initialization, Stripe Elements confirmation, result handling) with backend-owned payment truth.

- 9.1 Payment Contract & Architecture Audit — endpoint/status boundary audit before implementation.
- 9.2 Payment Feature Foundation — `features/payments/` structure with feature-local state.
- 9.3 Payment API & Data Access — typed service over `ApiClient` with cancellation.
- 9.4 Payment State & Lifecycle — 8-stage signals machine; `Initialized ≠ Succeeded`.
- 9.5 Stripe.js / Elements Integration Boundary — isolated `PaymentProvider` abstraction, SSR-safe.
- 9.6 Payment Initialization — orderId → backend intent; client secret memory-only.
- 9.7 Payment Confirmation — provider confirmation, duplicate prevention, outcome mapping.
- 9.8 Payment Result & Status Handling — explicit outcome hub with backend as final truth.
- 9.9 Failure, Pending, Cancellation & Retry — idempotent retry; unknown outcomes check backend status; no blind retry, no loops.
- 9.10 Payment UI & Checkout Integration — `/payment/:orderId` + `/result` routes with all states.
- 9.11 Security, SSR & Sensitive Data Handling — zero secrets/cards/storage/URL leaks (audited).
- 9.12 Testing & E2E Verification — unit/state/API/provider/component + outcome journeys.
- 9.13 Final Verification & Documentation — builds, lint, regression, doc sync.

Deliverables: payments slice + Stripe seam + 5-culture copy; 1479 unit tests; payments E2E 4 passed / 5 gated-skipped; checkout regression 12/12; audit 102/102. ADRs 021–022.

---

## Phase 10 — Orders & Customer Account ✅ Complete (2026-09-22)

Objective: post-purchase experience — account, profile, orders list/details, status/sync UX.

- 10.1 Orders Contract Audit & Feature Foundation — contracts + `features/orders/` foundation.
- 10.2 Customer Account & Profile — `/account` shell + read-only profile (no editing).
- 10.3 Orders List — paged list with backend totals/statuses only.
- 10.4 Order Details — identifiers/addresses/items/totals; 404/403/401 handling; contract fields only.
- 10.5 Order & Payment Status Experience — independent localized badges with unknown fallback; no cross-derivation.
- 10.6 Order History & Post-Payment Synchronization — history pinned unsupported; bounded sync (immediate + 2s ticks, 30-tick budget).
- 10.7 Routing, Authorization & Account UX — lazy routes, guards, return-URL, deep links, result → order navigation.
- 10.8 Localization, RTL, Responsive Design & Accessibility — full coverage.
- 10.9 Testing, E2E & Phase Completion — 5 customer journeys + full verification.

Deliverables: account tree + bounded sync loop + status badges; 12-test HTTP integration spec; E2E 90 passed; audit 102/102.

---

## Phase 11 — Storefront Production Readiness ✅ Complete (2026-09-25)

Objective: production-oriented Storefront v1 (hardening, performance, UX, SEO, security) with no new commerce capabilities.

- 11.1 Production Readiness Baseline — architecture/build/SSR/env/routes/states/tests review; gaps G01–G15.
- 11.2 SSR & Hydration Verification — zero mismatches, guarded browser APIs, no duplicate requests, no private leakage.
- 11.3 SEO Metadata — page-aware title/meta/canonical strategy (private pages excluded).
- 11.4 OpenGraph & Social Metadata — OG/twitter tags with fallback image; no misleading tags.
- 11.5 Image Optimization — priority/dimensions/lazy-below-fold/fallbacks; reduced layout shift.
- 11.6 Route & Resource Lazy Loading — all features lazy; no eager cross-feature deps; lazy-nav failure handling.
- 11.7 Storefront Performance Verification — evidence-justified optimizations only (Stripe constants split out).
- 11.8 Accessibility Hardening — semantics, keyboard, focus, labels, announcements, contrast, headings, RTL.
- 11.9 Responsive & Cross-Viewport Verification — all critical pages × 3 viewports, no overflow.
- 11.10 Loading, Empty & Error UX Hardening — intentional states everywhere incl. 401/403/404.
- 11.11 404 & 500 Error Handling — localized pipeline 404 + static user-friendly 500.
- 11.12 Production Security Review — env/auth/SSR/payments/API/rendering sweep, clean.
- 11.13 Production Build & Runtime Verification — fresh SSR build/server verification, clean consoles.
- 11.14 Critical Storefront Journey Verification — full Auth→Account Playwright re-verification.
- 11.15 Architecture & Documentation Synchronization — context/architecture/ADR sync + Phase 12 handoff.

Deliverables: Storefront v1 (15/15 prerendered, ~361 kB raw / ~100 kB transfer); audit 102/102; 1363 + 397 + 20 unit tests; E2E journeys green. ADRs 023–025.

---

## Phase 12 — Admin Portal Foundation ✅ Complete (2026-09-26)

Objective: admin architecture + reusable UI infrastructure with no business features.

- 12.1 Admin Route & Authorization Integration — `Admin`/`SuperAdmin` shell protection, login/forbidden handling.
- 12.2 Admin Application Architecture & Shell — business-free shell (Header/Sidebar/Outlet/Notifications).
- 12.3 Admin Navigation & Sidebar — extensible localized role-aware navigation + responsive drawer.
- 12.4 Dashboard Foundation — route/layout/cards with placeholders only (no invented APIs).
- 12.5 Admin Table & Pagination Primitives — generic `DataTable<T>` + pagination on the API contract.
- 12.6 Filtering & Form Primitives — business-agnostic search/select/date-range/filter-bar + form primitives.
- 12.7 Dialogs & Notifications — accessible dialog + notification pipeline.
- 12.8 Admin State & Data Lifecycle — signals-only, no NgRx/store, explicit lifecycle.
- 12.9 Responsive, RTL, Localization & Theme Hardening — shared infra reuse + verification.
- 12.10 Admin Testing & End-to-End Verification — guards/shell/nav/dashboard/auth-flow E2E.
- 12.11 Architecture Verification & Cleanup — boundary checks; parallel transports forbidden.
- 12.12 Documentation & Phase Completion — doc sync + completion report.

Deliverables: guarded shell + admin-owned shared primitives (ADR-026 keeps `libs/ui` closed); audit 106/106; 103 + 397 + 1363 tests; access-control E2E green.

---

## Phase 13 — Admin Catalog & Inventory ✅ Complete (2026-09-27)

Objective: functional commerce management for Catalog + Inventory on real backend contracts.

- 13.1 Foundation & Backend Contract Alignment — endpoint/DTO/pagination/filter/sort/validation/auth + gap audit.
- 13.2 Admin Catalog Feature Foundation — structure, routes, API, state, nav.
- 13.3 Product Management — list/pagination/sort/filter + create/edit/details/lifecycle with typed forms.
- 13.4 Product Variants Management — list/details/create/edit/delete without duplicating SKU/price/stock rules.
- 13.5 Category Management — flat parent-model CRUD + lifecycle.
- 13.6 Product Images & Specifications — URL-only image management (primary/reorder) + spec CRUD.
- 13.7 Catalog Integration & Hardening — nav/routing/guards/state/errors/i18n/RTL/a11y + tests.
- 13.8 Inventory Feature Foundation — structure, routes, models, API, state, nav.
- 13.9 Stock & Inventory Status — backend-provided quantities only, no recalculation.
- 13.10 Reservations & Inventory Adjustments — backend-owned reservation visibility + additive adjustment flow.
- 13.11 Phase Verification, E2E & Documentation — functional/E2E/quality verification + doc sync.

Deliverables: catalog + inventory slices with contract-honest gaps pinned (ADR-027/028); audit 106/106; 389 + 423 + 1363 tests; 13 catalog E2E green.

---

## Phase 14 — Admin Orders & Payments ✅ Complete (2026-09-29)

Objective: admin Orders & Payments vertical slice on real contracts without invented capabilities.

- 14.1 Foundation & Backend Contract Alignment — contract boundary, enums, filters/pagination, gaps.
- 14.2 Admin Orders Feature Foundation — structure/routes/API/state/models.
- 14.3 Orders List & Pagination — server-paginated sanctioned table with resource states.
- 14.4 Orders Filtering & Status Presentation — contract-supported filters + localized status badge.
- 14.5 Order Details & Customer Information — route-param details with address-echo customer info.
- 14.6 Payment Integration & Order-Payment Presentation — by-order payment chain where the contract supports it.
- 14.7 Payment Details, Status & Failed Payments — 6-state badge; backend-supplied failure info only.
- 14.8 Payment History — gap documented, not fabricated.
- 14.9 Localization, RTL, Responsive & Accessibility Hardening — 5-culture parity + verification.
- 14.10 Orders & Payments E2E + Integration Verification — end-to-end flow + unit/component tests.
- 14.11 Architecture, Security, Performance & Documentation — chain/auth/perf verification + doc sync.

Deliverables: orders + payments slices (history absent pinned, ADR-029/030); 508 + 454 + 1363 tests; 46 E2E green; audit 106/106.

---

## Phase 15 — Final QA & Optimization ⏳ Open (not started)

Scope (verification only — not the beginning of testing): full unit/component verification, full E2E verification, accessibility audit, RTL verification, localization verification, responsive verification, browser verification, performance + bundle analysis, SSR/hydration verification, security review, final architecture review, documentation synchronization.

---

## Supplement S1 — Backend Contract Evolution ✅ Complete

Objective: frontend for the evolved backend contract (action-permission system, identity growth, admin lists, live dashboard).

- S1.1 Contract alignment gate — callable tables, aliases, classifiers, gaps as pure `libs/models` + ADR-031.
- S1.2 Shared models & API endpoints — identity/catalog/orders/payments/inventory/dashboard types + `IdentityApiService`.
- S1.3 Permission authorization — permission signals, `SuperAdmin` supremacy, `permissionGuard`, route/nav migration (ADR-032).
- S1.4 Profile editing — `PUT /auth/profile` typed form with nullable semantics.
- S1.5 Admin users & permissions — SuperAdmin-only list/counts/details/grant/revoke.
- S1.6 Catalog `catalog.manage` migration + variant price/status editing.
- S1.7 Inventory lists & counts — paged stock/reservation lists + counts cards.
- S1.8 Admin orders upgrade + storefront status filter — platform-wide list, counts, force-cancel, refund.
- S1.9 Payments mine + admin + stats — customer list + platform-wide list/stats/details (read-only).
- S1.10 Admin dashboard — live `GET /admin/dashboard` snapshot + newest-5 drill-down.
- S1.11 Hardening, E2E & documentation — full matrix + docs.

Deliverables: permission-aware admin + live surfaces; 735 + 520 + 1433 tests; E2E 201 passed; audit 106/106.

---

## Supplement S2 — Adaptive Dashboard & Delegated Admin ✅ Complete

Objective: frontend for the Phase 22 backend evolution (permission catalog v2, delegated users, adaptive nullable dashboard).

- S2.1 Contract re-audit gate — v2 boundary as pure `libs/models` + ADR-034.
- S2.2 Shared models & endpoints — v2 catalog, nullable dashboard, `CatalogCountsResponse`.
- S2.3 Adaptive dashboard landing — per-entitlement sections + catalog card + honest empty state.
- S2.4 Delegated users management — `users.read`/`users.manage` reads/writes + `admins.create` creation.
- S2.5 403 discipline verification — single-refresh-then-locked; verification-only, no code changes.
- S2.6 New & extended E2E suites — dashboard + users journeys + full re-verification.
- S2.7 Hardening, verification & documentation — matrix + doc sync.

Deliverables: adaptive dashboard + delegated users; 756 + 552 + 1433 tests; E2E 179 passed; audit 106/106.

---

## Supplement S3 — Users Write Re-centralization ✅ Complete

Objective: frontend for the removal of `users.manage`/`admins.create` — SuperAdmin-only writes, delegated reads.

- S3.1 Contract delta re-audit gate — v3 catalog (9 values), moved gates, retired codes + ADR-035.
- S3.2 Shared models & endpoints — v3 shapes; paths/bodies byte-identical, only gates moved.
- S3.3 Routes & navigation — users mount on `users.read`; creation on `SuperAdmin` role.
- S3.4 Pages — SuperAdmin-only grant UI + hidden creation link; dashboard link follows section presence.
- S3.5 403 discipline verification — verification-only, no code changes.
- S3.6 Updated E2E suites — re-centralized flows + full re-verification.
- S3.7 Hardening, verification & documentation — matrix + doc sync.

Deliverables: re-centralized writes + delegated reads; 756 + 564 + 1433 tests; E2E 179 passed; audit 106/106. S1/S2 frozen as history.

---

## Refactoring Pass A–E ✅ Complete

Objective: whole-frontend structural cleanup with zero behavior/wire/contract/UX change. Full record: `docs/adr/037-frontend-refactoring.md`.

- A — Shared foundation in `libs/`: canonical `money`, `failure`, `cart-identity`, `image`, `quantity` pure modules + specs; `SocialImageCandidate` alias; symmetric `previousPageQuery`.
- B — Duplicate unification: admin `StatusBadge` ×4 → generic + adapters; storefront pager + status-badge unification; quantity/failure mirrors adopted; evaluated-keeps recorded (field-errors, steppers, summaries, catalog pager).
- C — Cart isolation: `CART_CAPABILITIES` seam; zero cart internals outside `cart/`; permanent audit rule (107/107).
- D — Structural organization: dead `core/` removed; `design-preview` → `app/dev/`; documented co-locations (account/orders, dashboard exception); no cosmetic churn.
- E — Focused splits + canonical adoption: `payment-lifecycle` extraction; failure/quantity delegation; cohesive classes/pages untouched by design.
- F — ADR-037 + context/architecture sync + full verification.

Verification per phase: `tsc`, `eslint`, `prettier`, `verify-architecture` 107/107, targeted + full suites (storefront 1494, admin 796, libs 194 — green), both production builds green. Pre-existing issues proven unrelated and recorded (environmental E2E red on clean HEAD; one pre-existing prettier drift; one latent suite-order culture hazard).
