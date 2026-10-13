# FluxCommerceFront

> Production-oriented Angular 22 storefront + admin portal for the FluxCommerce enterprise commerce platform — contract-driven, localized (5 cultures, RTL-first), themed, tested, and production-built.

[![Angular](https://img.shields.io/badge/Angular-22-DD0031)](#tech-stack)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6)](#tech-stack)
[![Storefront](https://img.shields.io/badge/storefront-SSR%20%2B%20SEO-1976D2)](#storefront)
[![Admin](https://img.shields.io/badge/admin-CSR-388E33)](#admin-portal)
[![i18n](https://img.shields.io/badge/i18n-en%20fr%20de%20es%20ar%20%2B%20RTL-6A1B9A)](#platform-capabilities)
[![Architecture](https://img.shields.io/badge/architecture%20audit-107%2F107-success)](#quality-gates)

---

## What is this?

This repository holds the **frontend** of FluxCommerce: two Angular applications in one workspace that consume the FluxCommerce ASP.NET Core API through explicit, typed contracts — and never reproduce backend business orchestration (ordering, inventory reservation, payment verification, sagas, and compensation all stay server-side).

```text
Customer → Browse → Product → Cart → Checkout → Order → Pay (Stripe) → Result → Account
Admin    → Dashboard → Catalog → Inventory → Orders → Payments → Users
```

It is built as a portfolio-grade demonstration of how to ship a **clean, performant, localized, accessible, production-oriented client** for a distributed-style backend: feature-owned vertical slices, signals-only state, strict dependency boundaries enforced by lint + script audit, and contract-honest UI (backend gaps are pinned and tested, never fabricated).

---

## Storefront

Customer-facing application — **SSR-enabled, SEO-sensitive** — served at `http://localhost:4200`.

| Area            | Route                                                                    | Highlights                                                                                   |
| --------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Home            | `/`                                                                      | Localized entry, SEO metadata                                                                |
| Catalog         | `/catalog`, `/products`, `/catalog/categories`                           | Search, filters, sort, pagination, product cards                                             |
| Product details | `/catalog/products/:id`                                                  | Gallery, variants, live SKU + backend-issued price, quantity, add to cart                    |
| Cart            | `/cart`                                                                  | Guest + authenticated carts, atomic guest → login merge (mandatory tested journey)           |
| Checkout        | `/checkout` (auth)                                                       | Typed address forms, backend-facts-only summary, `Idempotency-Key` order creation            |
| Payment         | `/payment/:orderId`, `/payment/:orderId/result` (auth)                   | Stripe Elements via isolated provider boundary, secret memory-only, backend verification hub |
| Account         | `/account/profile`, `/account/orders`, `/account/orders/:orderId` (auth) | Read-only profile (+ editing), paged orders, details with bounded post-payment sync          |
| Auth            | `/login`, `/register`, `/verify-email`, …                                | JWT + refresh lifecycle, guards, return-URL redirects                                        |

---

## Admin Portal

Internal administration application — **CSR, authenticated, role/permission-gated** — served at `http://localhost:4201`.

| Area      | Highlights                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------ |
| Dashboard | Adaptive per-entitlement sections (orders, payments, inventory, catalog, users) + revenue chart + drill-down |
| Catalog   | Products, variants (incl. price/status), categories, URL-only images, specifications                         |
| Inventory | Paged stock/reservation lists, counts, single lookups, additive adjustments                                  |
| Orders    | Platform-wide list with filters, counts, details, force-cancel, refund                                       |
| Payments  | Platform-wide list with filters, stats (incl. refunded rollups), details — read-only                         |
| Users     | Delegated reads for `users.read` holders; writes and admin creation are `SuperAdmin`-only                    |

Authorization model: `Customer` / `Admin` / `SuperAdmin` roles plus a 9-value action-permission catalog (`orders.read|cancel|refund`, `payments.read|stats`, `inventory.read|manage`, `catalog.manage`, `users.read`). Guards are UX-only; the backend is authoritative.

---

## Platform capabilities

- **Localization first-class** — `en`, `fr`, `de`, `es`, `ar`; language switching with persistence; backend culture sync (`Accept-Language`); `Intl` date/number/currency formatting; localized validation and API errors.
- **RTL from day one** — logical CSS properties exclusively (audit-enforced), `CultureService` as single writer of document `dir`, mirrored directional icons, Arabic-Indic digits.
- **Theming** — design-token CSS variables, centralized `ThemeService` (`data-theme="light|dark"`), WCAG AA contrast enforced; visual language in [`docs/DESIGN.md`](./docs/DESIGN.md) (Kinetic Bubble Neo — must-read before touching UI).
- **Auth platform** — tri-state session, memory-only access tokens, single-flight refresh, 401 recovery with at-most-once retry, auth/role/permission guards, SSR-safe shells.
- **API infrastructure** — typed `ApiClient` (sole `HttpClient` user), functional interceptor pipeline, normalized `ApiError` (status-first, never message text), correlation IDs, cancellation, pagination abstractions, signal resource states (`idle → loading → success | empty | error`).

---

## Architecture

```text
FluxCommerceFront (Angular 22 workspace)
│
├── apps/storefront/        # SSR customer app (lazy feature slices)
├── apps/admin/             # CSR admin app (guarded shell + lazy features)
│
├── libs/api/               # transport, interceptors, errors, pagination, contracts
├── libs/auth/              # session, tokens, guards, AuthNav
├── libs/ui/                # closed-set design primitives (business-free)
├── libs/i18n/              # culture, translations, formatting, error resolvers
├── libs/theming/           # tokens, reset, ThemeService
├── libs/models/            # shared contracts + canonical pure models
└── libs/utils/             # generic helpers (guards, SEO)
```

Rules that stay green by construction (`npm run verify:architecture`, 107/107):

- `Apps → Features → Shared Libraries`, never the reverse; no cross-app imports.
- Features own their slices; cross-feature needs go through stable contracts (e.g. the cart `CART_CAPABILITIES` seam) — never feature internals.
- Global state holds only auth, user, culture, theme, and config.
- Backend contracts are the source of truth; backend authorization is authoritative.

📄 Full specification: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) · [`docs/PROJECT_CONTEXT.md`](./docs/PROJECT_CONTEXT.md)

---

## Tech stack

| Layer                  | Technology                                                                    |
| ---------------------- | ----------------------------------------------------------------------------- |
| Framework              | Angular 22 (standalone components + routing, Signals, SSR)                    |
| Language               | TypeScript (strict)                                                           |
| State                  | Component signals + route-provided feature state (no store library)           |
| HTTP                   | Angular `HttpClient` behind typed `ApiClient` + functional interceptors       |
| Forms                  | Typed Reactive Forms                                                          |
| Unit / component tests | Vitest                                                                        |
| E2E tests              | Playwright (mocked transports)                                                |
| Styling                | CSS custom properties + design tokens, logical properties                     |
| Backend consumed       | ASP.NET Core API (`https://localhost:7119`), Stripe.js (publishable key only) |

---

## Project structure

```text
apps/
├── storefront/src/app/
│   ├── core/              # removed (was empty scaffolding)
│   ├── layout/            # shell, header, nav, footer, culture switch
│   ├── features/          # auth, home, catalog, product-details, cart,
│   │                      # checkout, payments, orders (account+orders)
│   ├── shared/            # storefront-owned shared UI (pager, status badge)
│   ├── dev/               # dev-only surfaces (design preview)
│   └── app.routes.ts
│
└── admin/src/app/
    ├── layout/            # shell, sidebar, header, forbidden/not-found
    ├── features/          # auth, dashboard, catalog, inventory,
    │                      # orders, payments, users
    ├── shared/            # admin-owned shared UI (table, pager, filters,
    │                      # forms, dialog, notifications, status badge)
    └── app.routes.ts

libs/                     # api, auth, ui, i18n, theming, models, utils
e2e/                      # Playwright journeys (storefront + admin)
docs/
├── PROJECT_CONTEXT.md     # master state & direction
├── ARCHITECTURE.md        # architectural reference
├── IMPLEMENTATION_PLAN.md # consolidated phases + sub-phases + status
├── DESIGN.md              # visual design system
├── frontend-contract/     # backend API source of truth
└── adr/                   # 37 architecture decision records
```

---

## Getting started

### Prerequisites

- Node.js 24 + npm 11 (`packageManager: npm@11.16.0`)
- The FluxCommerce backend API reachable at `https://localhost:7119` (see `apps/*/src/environments/environment.ts`; dev-only Swagger at `/swagger`)
- A Stripe **publishable** test key for the payment flow (never a secret key — see `apps/storefront/src/environments/stripe-environment.ts`)

> The API currently serves no CORS headers, so browser use needs a proxy/gateway or local CORS configuration on the API side (see `docs/frontend-contract/API_CONTRACT.md`, Appendix A).

### Setup

```bash
# clone
git clone https://github.com/<your-org>/fluxcommerce-front.git
cd fluxcommerce-front

# install
npm install

# run the storefront (SSR) and the admin portal (CSR)
npm run start:storefront   # http://localhost:4200
npm run start:admin         # http://localhost:4201
```

### Scripts

| Command                                                           | What it does                                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `npm run start:storefront` / `start:admin`                        | Dev servers (:4200 / :4201)                                               |
| `npm run build` / `build:storefront` / `build:admin`              | Production builds (SSR prerender + CSR)                                   |
| `npm run typecheck` (+ `:storefront`, `:admin`, `:libs`, `:spec`) | `tsc --noEmit`, zero errors expected                                      |
| `npm run lint`                                                    | Prettier check + ESLint boundaries                                        |
| `npm run verify:architecture`                                     | 107 structural checks (boundaries, SSR/CSR, routing, security, cart seam) |
| `npm run test:unit`                                               | Full Vitest suites (apps + libs)                                          |
| `npm run test:e2e`                                                | Full Playwright suite (mocked transports)                                 |

---

## Quality gates

Every change is expected to keep all of these green:

- **Typecheck** — `tsc --noEmit` across apps, libs, and specs: 0 errors.
- **Lint** — Prettier + ESLint (incl. import-direction and `HttpClient` ownership rules): 0 errors.
- **Architecture audit** — `npm run verify:architecture`: **107/107** (standalone, SSR/CSR posture, routing, no cycles, UI/theming decoupling, secret hygiene, cart-seam isolation).
- **Unit/component tests** — **2,290 across both apps (1,494 storefront · 796 admin)** plus shared-library suites, all passing with no assertion weakened by refactoring.
- **Production builds** — Storefront SSR (17 prerendered routes) + Admin CSR, zero errors, no budget warnings.
- **E2E** — Playwright journeys green on a live-capable environment (documented pre-existing environment caveats in `docs/adr/037-frontend-refactoring.md`).

---

## Roadmap status

| Scope                                                                                    | Status      |
| ---------------------------------------------------------------------------------------- | ----------- |
| Phases 0–14 (foundation → storefront → admin portal)                                     | ✅ Complete |
| Supplements S1–S3 (contract evolution, delegated admin, write re-centralization)         | ✅ Complete |
| Refactoring pass A–E (shared foundation, unification, cart isolation, structure, splits) | ✅ Complete |
| Phase 15 — Final QA & Optimization                                                       | ⏳ Open     |

Full phase-by-phase history (objectives, sub-phases, deliverables, metrics): [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md)

---

## Documentation

- [`docs/PROJECT_CONTEXT.md`](./docs/PROJECT_CONTEXT.md) — master state, direction, constraints, roadmap
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — boundaries, state, API, auth, testing rules
- [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) — consolidated implementation history
- [`docs/DESIGN.md`](./docs/DESIGN.md) — Kinetic Bubble Neo design system (read before touching UI)
- [`docs/frontend-contract/`](./docs/frontend-contract) — backend API source of truth (endpoints, DTOs, enums, errors, auth flow)
- [`docs/adr/`](./docs/adr) — 37 architecture decision records
