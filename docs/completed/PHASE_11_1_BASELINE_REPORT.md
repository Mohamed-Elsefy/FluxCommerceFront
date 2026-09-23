# Sub-Phase 11.1 — Production Readiness Baseline: Completion Report

Status: **Complete** — 2026-09-23.

Sub-Phase 11.1 establishes a reliable baseline before any production-readiness
changes (per `docs/phases/PHASE_11_STOREFRONT_PRODUCTION_READINESS.md` §11.1).
No Storefront behavior was changed in this sub-phase: no optimizations, no SEO
changes, no image changes, no error-page changes, no security changes. All
follow-up work belongs to 11.2–11.15.

Related references: `docs/PROJECT_CONTEXT.md` (§§31–32),
`docs/ARCHITECTURE.md`, `docs/phases/PHASE_11_STOREFRONT_PRODUCTION_READINESS.md`
(§11.1), `docs/frontend-contract/`, `docs/adr/`,
`docs/completed/PHASE_10_COMPLETION_REPORT.md`.

---

## 1. Storefront architecture after Phase 10 (review)

```text
Storefront (SSR, apps/storefront)
├── shell (eager): AppLayout + Header + Navigation + Footer
├── home (lazy loadComponent: '')
├── auth (lazy loadChildren: '')
├── catalog/products (lazy, must stay before catalog)
├── catalog (lazy)
├── cart (lazy)
├── checkout (lazy, auth-guarded at boundary)
├── payment (lazy, auth-guarded at boundary)
├── account (lazy, auth-guarded at boundary)
└── ** → NotFoundPage (lazy loadComponent)
```

- Feature ownership holds: Catalog / Product-Details / Cart / Checkout /
  Payments / Orders each own routes, state (route-provided signals only),
  data access (`ApiClient`), models, i18n. No cross-feature internal imports.
- State: route-provided signals/computeds only. No global store, no NgRx /
  SignalStore. Global scope remains Auth / Culture / Theme / AppEnvironment.
- API: Component → Feature Service/Store → ApiClient → HttpClient → ASP.NET
  Core. Backend contracts are source of truth; contract gaps stay honest
  (no fabricated price/availability/payment-secret/history endpoints).
- Libraries: `libs/api` sole HttpClient owner; `libs/ui`/`libs/theming`
  business-agnostic; `libs/i18n` owns cultures/translations/formatting.

## 2. Production build configuration (review)

`angular.json` `storefront.build`:

- Builder `@angular/build:application`, `outputMode: server`,
  `server: main.server.ts`, `ssr.entry: server.ts`.
- `production`: initial budget 500kB warning / 1MB error;
  `anyComponentStyle` 4kB / 8kB; `outputHashing: all`;
  `environment.ts` → `environment.prod.ts` replacement.
- Global styles order: `reset.css` → `tokens.css` → `styles.css` (correct).
- Admin remains CSR-only (no server/ssr/hydration) — untouched.

## 3. SSR configuration (review)

- `app.config.ts`: `provideClientHydration()` + router + api/auth/culture/
  theming providers. `app.config.server.ts` merges
  `provideServerRendering(withRoutes(serverRoutes))`.
- `app.routes.server.ts`:
  `catalog/products/:id`, `payment/:orderId`, `payment/:orderId/result`,
  `account/orders/:orderId` → `RenderMode.Server`;
  `**` → `RenderMode.Prerender`.
- `server.ts`: Express static (`maxAge 1y`, `index: false`) + Angular engine
  fallback; `PORT` env or 4000. No API proxy routes defined.

## 4. Production environment (review)

- `environment.prod.ts`: `{ production: true, appName: 'storefront',
  apiBaseUrl: '/api' }` — same-origin default, no baked host. Public only.
- `stripeEnvironment` (prod): public script URL + `pk_test_*` publishable key
  only. No secret/client-secret. Test key must be replaced per deployment
  (pinned gap G12 below).
- Arch audit confirms: no hard-coded API URLs outside `environments/`,
  no secrets in env files, no Stripe secrets in sources.

## 5. Routing and lazy loading (review)

- All feature areas are lazy (`loadChildren` boundaries + `loadComponent`
  pages). Shell stays eager by convention. Verified in production bundle:
  named lazy chunks exist for `product-details-page`, `checkout-page`,
  `categories-page`, `cart-page`, `order-details-page`, `orders-list-page`,
  `payment-page`, `payment-result-page`, `profile-page`, plus route-table
  chunks (`catalog-routes`, `cart-routes`, `checkout-routes`,
  `payments-routes`, `orders-routes`, `account-routes`, `auth-routes`,
  `not-found-page`, `home-page`, `login-page`, etc.).
- No eager feature imports detected (arch audit + bundle chunk split agree).

## 6. Loading / empty / error states (review)

- Pattern is feature-owned resource slots + shared `libs/ui` primitives
  (`LoadingIndicator`, `Skeleton`, `EmptyState`, `ErrorState`,
  `RetryButton`). Present on catalog, product-details (incl. invalid-id /
  not-found), cart, checkout (failure-recovery matrix), payments (guarded
  8-stage lifecycle), orders list/details (incl. distinct 401/403/404),
  profile.
- `NotFoundPage` (`**` route) is currently a bare static stub (see G09):
  unlocalized hard-coded English, no shared UI, no nav back beyond `/`.

## 7. Verification runs (this sub-phase, 2026-09-23)

```text
node scripts/verify-architecture.mjs   102/102 checks passed
npm run typecheck                       0 errors (storefront, admin, libs, specs)
npm run lint:boundaries (eslint .)      0 errors
npm run build:storefront                success (SSR + prerender, 0 errors)
  Browser initial total                 359.87 kB raw / 99.53 kB transfer
    chunk-BwGcPQuv.js                   209.97 kB / 61.83 kB
    main-2H6H7HZG.js                    143.63 kB / 35.63 kB
  Budgets                               within 500kB warn / 1MB error
  Server                                server.mjs 820.27 kB,
                                        main.server.mjs 462.90 kB,
                                        polyfills.server.mjs 234.99 kB
  Prerender                             15 static routes
vitest run (libs)                       56 files / 390 passed
ng test storefront --watch=false        115 files / 1321 passed
ng test admin --watch=false             8 files / 20 passed (untouched)
E2E (baseline, not re-run here)         Phase 10 exit state:
                                        90 passed / 7 skipped / 0 failed
                                        across 97 suites (5 orders green;
                                        skips: 1 orders + 5 payments
                                        provider-gated + 1 culture SSR)
```

E2E inventory (all under `e2e/`, wired in `playwright.config.ts`):
`storefront`, `storefront-auth`, `catalog`, `product-details`, `cart`,
`checkout`, `payments`, `orders`, `culture` (storefront+admin),
`admin`, `admin-auth`. Full E2E re-run belongs to 11.13–11.14 against
production artifacts, not to this baseline.

## 8. Concrete Phase 11 gaps (outputs for 11.2–11.15)

No fixes applied here. Each gap names its owning sub-phase.

```text
G01 (11.2 SSR/hydration): SSR/hydration not yet verified end to end
      (server HTML meaningfulness, mismatch scan, browser-API audit
      for window/document/localStorage/sessionStorage, TransferState
      consistency, duplicate-request check, direct navigation, API-failure
      SSR paths, private-data leakage review for auth routes).
G02 (11.3 SEO): no page-aware SEO strategy doc; index.html carries only
      static `<title>Flux Commerce</title>` with no description/canonical.
      Only product-details + categories set Title/Meta today; home listing,
      checkout/payments/account titles are ad hoc (`| FluxCommerce` vs
      bare). No canonical URL handling anywhere.
G03 (11.4 OpenGraph): only og:title/og:description/og:type on two pages.
      Missing og:url + og:image everywhere; no fallback social image;
      no-data (no-image product) behavior unverified; invalid resources
      must not emit misleading tags.
G04 (11.5 images): only product-gallery sets loading hints
      (first eager, rest lazy). No responsive (srcset/sizes) or
      NgOptimizedImage policy; no dimension-preservation / CLS audit;
      card/gallery/category fallbacks and broken-image paths unverified;
      OG-image suitability open.
G05 (11.6 lazy): lazy boundaries verified present, but noUX/failure audit
      (lazy-navigation skeletons, direct-URL loads, chunk-load failure
      handling, accidental eager-import scan beyond the arch script,
      chunk-fragmentation review).
G06 (11.7 perf): bundle measured (see §7) but no perf pass yet —
      no initial/lazy chunk review against UX, no duplicate-HTTP audit,
      no render/change-detection review, no image/hydration cost review.
      Initial 359.87 kB raw is inside budget; optimizations require
      evidence per the Baseline → Measure → Gap → Fix principle.
G07 (11.8 a11y): feature-level a11y exists (semantics, focus management,
      aria-busy/alert/status, visible focus, contrast AA) but no
      Storefront-wide hardening pass (nav/forms/dialogs/buttons/links/
      images/loading/errors/checkout/payment/orders/account, headings,
      dynamic announcements, RTL interaction).
G08 (11.9 responsive): breakpoints/tokens verified, but no page-by-page
      mobile/tablet/desktop verification (home/catalog/product/cart/
      checkout/payment/orders/account, overflow scan, gallery/forms/
      header/dialogs, long localized strings, RTL + themes).
G09 (11.10/11.11 errors): NotFoundPage is an unlocalized hard-coded stub
      with no shared UI, no SSR/direct-navigation verification, no
      localized 404 UX. No 500 path exists (SSR/server-failure UX,
      no stack-trace/internal-detail leakage proof beyond dev behavior).
G10 (11.10 states): loading/skeleton/empty/error/retry exist per feature
      but consistency pass outstanding (skeleton usage, unauthorized vs
      not-found vs generic, localized messages, backend-detail masking).
G11 (11.12 security): baseline clean (no secrets per audit) but formal
      review outstanding — prod env values, token/interceptor handling,
      route protection vs backend authority, unsafe HTML/user content,
      SSR data exposure, Stripe public-only config, error leakage,
      security-sensitive logging.
G12 (11.12/11.13 config): prod Stripe publishable key is still the shared
      test key (`pk_test_51TkOL…` in both env files) — replace per
      deployment. Prod API base `/api` assumes same-origin/proxy — verify
      against deployment topology during 11.13 runtime verification.
G13 (11.13 runtime): production artifact (dist/storefront server.mjs +
      browser) built but not yet served/verified (public + auth routes,
      API comms, l10n/RTL/themes, error pages, lazy routes, refresh/
      direct nav, console/server-log scan).
G14 (11.14 journeys): critical journey (auth → catalog → product → cart →
      checkout → payment → order → account → details) last green in
      Phase 10 dev-mode E2E; production-like re-verification outstanding.
G15 (11.15 docs): PROJECT_CONTEXT/ARCHITECTURE sync for Phase 11 plus
      SSR/SEO/perf/error/security ADRs deferred until 11.2–11.14
      stabilize. Phase 12 handoff not yet written.
```

Out of scope (explicitly not Phase 11): Admin Portal, backend workflow
changes, payment orchestration, SSR/design-system/l10n/auth rebuilds,
full Phase 15 system QA.

---

## 9. Definition of Done (§11.1 acceptance — item-by-item)

```text
[x] Current Storefront state is understood and documented (this report)
[x] Production build succeeds (see §7)
[x] SSR build succeeds (server.mjs + 15 prerendered routes, see §7)
[x] Existing tests establish a clean baseline (arch 102/102, typecheck 0,
    eslint 0, libs 390, storefront 1321, admin 20 — see §7)
[x] Concrete Phase 11 gaps are identified (G01–G15 above)
```

Next: **Sub-Phase 11.2 — SSR & Hydration Verification**, consuming G01
(plus G11 SSR-exposure and G13 runtime seams as inputs).
