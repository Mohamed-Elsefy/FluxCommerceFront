# Phase 5 — Catalog & Product Discovery: Completion Report

Status: **Complete** — 2026-09-12.

Phase 5 delivers the first complete customer-facing commerce capability:
from the Storefront Home page a customer discovers categories, opens a
category listing, and browses products through backend search, filters,
sorting, and pagination — localized in five cultures, RTL-safe,
responsive, and SSR-compatible. All twelve sub-phases (5.1–5.12) are
done in dependency order, all completion criteria are satisfied, and
the project is ready for **Phase 6 — Product Details & Variants**.

Related references: `docs/PROJECT_CONTEXT.md` (§26),
`docs/ARCHITECTURE.md` (§§5, 9, 14, 21),
`docs/phases/PHASE_5_CATALOG.md`, `docs/adr/012–014`.

The final boundary holds: the customer can discover and browse
products, but cannot yet select/configure or purchase one (no
variants, quantities, cart, or checkout anywhere in the tree —
audit-verified, insulted only in scope comments and absence-guard
tests).

---

## 1. Sub-phase summary

```text
5.1  Catalog Feature Foundation
     features/catalog/ (models, CatalogApiService over ApiClient,
     route-provided CatalogState with local Signals, lazy
     catalogRoutes). No global state, no NgRx/SignalStore, no raw
     HttpClient outside libs/api.

5.2  Home & Category Discovery
     Home entry section linking to /catalog; CategoriesPage discovery
     with category navigation (active selection via aria-current,
     categoryId query state, clear-selection link); full
     loading/empty/error states with retry.

5.3  Product Listing
     Reusable ProductCard (contract-strict: image, name, details link —
     price/availability do not exist in the list contract and are not
     fabricated) and ProductGrid (fluid auto-fill grid, list
     semantics); cards target the future /catalog/products/:id route.

5.4  Catalog Query State
     Immutable CatalogQueryState (search/category/filters/sort/page)
     with page-reset rules, setQueryPage preservation, one backend +
     route funnel (toBackendQuery → toQueryParams), total route
     round-tripping with garbage tolerance.

5.5  Search
     Timing-free SearchInput plus page-owned 300ms debounce,
     distinctUntilChanged, replaceUrl URL commits, empty-search
     restoration, and per-run AbortController stale-request safety
     over Phase 1.7 cancelOnAbort.

5.6  Filtering & Sorting
     Generic FilterSelect reused for status, visibility, and sort;
     options exactly matching the backend enums (no price/availability
     fabrication); per-control resets plus clear-all; filter-only deep
     links load the listing.

5.7  Pagination Integration
     Feature-owned ProductPagination (shared libs may not gain one)
     driven by RESPONSE-effective paging via shared totalPagesOf;
     First/Previous/numbers/Next/Last with a sliding window;
     setQueryPage preserves the full query; out-of-range pages resolve
     to the honest empty state.

5.8  Resource States & UX
     Differentiated listing empties ("no products in {category}" with
     loaded-name resolution vs "no matching products" under active
     criteria, all localized); unknown-failure stability proven at
     state level (never throws, always normalized).

5.9  Localization, RTL & Responsive
     Home-owned bundle closes the last copy gap (all catalog + home UI
     text in en/fr/de/es/ar); direction-structure invariance tests
     prove byte-identical LTR/RTL markup; 5-culture render test proves
     copy + root dir per culture; zero physical CSS properties and zero
     media queries in catalog stylesheets (fluid by construction).

5.10 SSR & SEO Integration
     TransferState hydration (per-query keys, consume-once, never on
     failure); dynamic Title/Meta (title, description, OpenGraph) in
     ngOnInit (server pass) refreshed by effect; prerender emits the
     idle shell with base metadata (verified in dist HTML); zero
     browser-only APIs in catalog production code.

5.11 Testing
     Feature integration spec (real State + DataAccess + ApiClient
     against HttpTestingController with contract-exact fixtures);
     7-test catalog E2E journey plus 3 viewport checks with
     backend-faithful mocked transport (live seed cannot paginate);
     spec-scoped HttpTestingController lint exception matching the
     rule's documented intent.

5.12 Hardening & Phase Completion (this sub-phase)
     Evidence audit (below), catalog viewport E2E, full verification
     battery, this report, PROJECT_CONTEXT §26, ARCHITECTURE as-built
     sync, ADRs 012–014.
```

---

## 2. Final workspace status (catalog surface)

```text
features/catalog/
  catalog.routes.ts + catalog-globalization.spec.ts
  components/  category-nav, filter-select, product-card,
               product-grid, product-pagination, search-input
               (each: ts + html + css + spec, no inline templates)
  data-access/ catalog-api.service(.spec) + catalog-integration.spec
  i18n/        catalog-translations(.spec) — full 5-culture bundle
  models/      catalog.models(.spec) — contract aliases + funnels
  pages/categories/  CategoriesPage(.spec) — discovery + listing
  state/       catalog-state(.spec) + catalog-query-state(.spec)
features/home/
  home-page(.spec) + i18n/home-translations(.spec)
e2e/catalog.spec.ts (journey ×7 + viewports ×3) + catalog-chromium
Guardrails  eslint.config.mjs (per-scope boundaries, incl. the 5.11
            spec testing seam) + scripts/verify-architecture.mjs
```

---

## 3. Hardening audit results (evidence, 2026-09-12)

```text
Lazy routes ................. app.routes (loadChildren catalog) +
                              catalog.routes (loadComponent discovery);
                              categories-page emitted as its own lazy
                              chunk in both browser and server bundles
State ownership ............. CatalogState has no providedIn (unit-pinned);
                              route-provided only; no NgRx/SignalStore
                              imports; no global catalog signals
HTTP layering ............... zero raw HttpClient imports in features
                              (one /testing import in the integration
                              spec — the sanctioned seam); libs/api the
                              single transport owner (audit-enforced)
Contract usage .............. CATALOG_ENDPOINTS route table + @flux/models
                              mirrors only; enums numeric on the wire;
                              no re-declared contract shapes
Cross-feature ............... catalog-internal relative imports only;
                              home imports its own i18n only; routes are
                              the sole cross-feature channel
Phase 6 absence ............. variant/quantity/SKU/cart/checkout/payment
                              terms occur only in scope comments and the
                              card absence-guard test (grep-verified)
Shared libs ................. still exactly the 7 libraries; no catalog
                              library created; libs/ui module set closed
RTL/CSS ..................... 0 physical-direction properties and 0 media
                              queries across all 8 catalog stylesheets
                              (tokens + logical properties only)
Browser APIs ................ zero window/document/localStorage/navigator
                              uses in catalog production code (specs only);
                              platform seams are isPlatformBrowser plus
                              SSR-safe TransferState/Title/Meta
Accessibility ............... labelled inputs, nav landmarks,
                              aria-current selections, alert roles,
                              :focus-visible on custom controls (reset
                              preserves native rings elsewhere)
```

---

## 4. Final verification results (2026-09-12, exit 0 throughout)

```text
npm run lint                  prettier + ESLint boundaries — 0 errors
npm run typecheck             apps + 7 libs + specs (incl. e2e) — 0 errors
npm run build:storefront      SSR + 8 prerendered routes — 0 errors
npm run build:admin           CSR — 0 errors
npm run test:unit:apps        storefront 31 files/230 tests,
                              admin 8/20 — 100%
npm run test:unit:libs        55 files/352 tests — 100%
npm run test:e2e (full)       50 passed, 1 skipped — 100%
                              (catalog journey 7 + catalog viewports 3;
                              the single skip is the intentional
                              admin-SSR case from Phase 4)
verify-architecture.mjs       97/97 checks
```

---

## 5. Key engineering decisions

- Smallest-scope state, structurally enforced: route-provided state
  plus pure query transitions made "no global store" a compile-time
  shape rather than a convention — see ADR 012/013.
- Contract fidelity over example text: price, availability, and sort
  options requested by phase examples do not exist in the catalog
  contract and were refused twice (card, filters), with tests pinning
  the absence.
- Single funnel or nothing: one UI→wire→URL path serves pages,
  deep links, E2E, and future phases; route parsing is total
  (garbage → defaults, never 400s from the client).
- Effects that touch their own slot run `untracked`, and every
  listing run owns an `AbortController`: the infinite-fetch loop this
  prevents once OOM-killed a test worker and is now regression-locked.
- Prerender honesty: with no backend at build time, SSR emits idle
  shells with real metadata instead of hanging on fetches; transfer
  state activates whenever a server render settles loads.

---

## 6. Known limitations

- `test:e2e` needs the dev servers + Playwright browsers; catalog
  transport is mocked with backend-faithful semantics because the
  live seed cannot paginate (largest category: 4 products) — the live
  contract path is proven by the HttpTestingController integration
  spec instead. The handlers isolate in one helper for a future live
  switch.
- Prerendered pages carry the idle shell (content loads post-
  hydration); server-data SEO beyond metadata awaits a backend that
  is reachable at render time.
- Category names/descriptions render backend-verbatim (data, not UI
  copy) by design.
- The vitest worker-startup flake (`Timeout starting threads runner`)
  and wedged worker pools required two retries with process cleanup
  during this phase; no test changes were involved.

---

## 7. Deferred work (explicit non-goals)

```text
Phase 6 — Product details/page, image gallery, variants, SKU,
          variant/quantity selection, add to cart
Phase 7+ — Cart, checkout, payments, orders, admin catalog
```

---

## 8. Documentation changes in this sub-phase

```text
docs/completed/PHASE_5_COMPLETION_REPORT.md   created (this file)
docs/PROJECT_CONTEXT.md                       §26 marked Complete + deliverable
docs/ARCHITECTURE.md                          §§5/9/14/21 as-built sync
docs/adr/012-catalog-state-isolation.md       created
docs/adr/013-unified-catalog-query-state.md   created
docs/adr/014-catalog-ssr-hydration.md         created
e2e/catalog.spec.ts                           viewport checks added (responsive proof)
```
