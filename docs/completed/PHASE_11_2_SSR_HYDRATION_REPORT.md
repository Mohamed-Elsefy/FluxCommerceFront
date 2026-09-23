# Sub-Phase 11.2 — SSR & Hydration Verification: Completion Report

Status: **Complete** — 2026-09-23.

Verifies SSR and hydration for the SEO-sensitive Storefront pages (per
`docs/phases/PHASE_11_STOREFRONT_PRODUCTION_READINESS.md` §11.2) against the
unchanged 11.1 production artifact (`dist/storefront`). No Storefront behavior
was changed in this sub-phase. Two findings are recorded for their owning
sub-phases (§7); neither blocks the §11.2 acceptance flow.

Related references: `docs/PROJECT_CONTEXT.md` (§§31–32),
`docs/ARCHITECTURE.md` (§§23–24), `docs/phases/` Phase 11 (§11.2),
`docs/completed/PHASE_11_1_BASELINE_REPORT.md` (gap G01),
`docs/adr/011-ssr-hydration-safety.md`, `docs/adr/014-catalog-ssr-hydration.md`.

---

## 1. Scope under verification

```text
Home              /                     Prerender  (static, no data fetch)
Category/Listing  /catalog              Prerender  (idle shell + metadata;
                                                   data loads browser-only)
Product Details   /catalog/products/:id RenderMode.Server (live fetch at
                                                   request time + TransferState)
```

Authenticated areas (`/payment/:orderId`, `/account/orders/:orderId`) are
`RenderMode.Server` shells whose data loads browser-only (`afterNextRender`);
they were probed for private-data leakage only — their UX belongs to
Phases 9–10, not to this sub-phase.

## 2. Method (no backend in this environment)

- Reused the 11.1 production build (`ng build storefront`: SSR + 15
  prerendered routes, 0 errors — not rebuilt, artifact unchanged).
- Served it with `node dist/storefront/server/server.mjs` on a local port.
  The server enforces Host validation from `angular.json`
  `security.allowedHosts` (currently `[]`, i.e. deny-by-default); the probe
  ran with the documented runtime override
  `NG_ALLOWED_HOSTS=localhost,127.0.0.1` (see finding F-11.2-1).
- Probed SSR HTML per route (status, meaningful content, hydration markers,
  stack-trace scan, secret scan), then drove the same artifact in headless
  Chromium (console/page errors, hydration, post-hydration interaction).
- Audited browser-only API usage across prod (non-spec) sources and the
  TransferState request-dedupe design against its server/client unit pairs.

## 3. SSR HTML verification (direct navigation, prod server)

```text
/                                          200  meaningful HTML (shell +
                                                home discovery/cart sections)
                                                hydration markers + ng-state
/catalog                                   200  shell + filters/search +
                                                "Catalog | FluxCommerce"
                                                title/meta (idle listing shell
                                                by design — no backend at
                                                prerender; browser loads live)
/catalog/products/<guid>                   200  live Server fetch attempted;
                                                graceful "Product not found"
                                                UX + title, no crash
/catalog/products/not-a-valid-id           200  invalid-id UX + title, no crash
/cart                                      200  guest standby shell, anonymous
/login                                     200  sign-in form, anonymous
/account/orders/<guid>                     200  anonymous shell (data loads
                                                browser-only post-hydration)
```

Every SSR response carried hydration markers (`ngh`, `ng-server-context`,
`ng-event-dispatch-contract`, `ng-state`) and, where applicable, page-aware
`Title`/`Meta` in `<head>`. No response contained a stack trace, framework
error text, or backend internals.

## 4. Hydration verification (headless Chromium vs prod server)

- `/`, `/catalog`, `/cart`, `/login`: app boots from SSR HTML, remains
  interactive (catalog search input accepts text; debounced query pipeline
  runs), document titles correct post-hydration.
- Zero hydration/mismatch framework errors and zero page errors. The only
  console errors were the app's own `/api/...` calls returning 404 (no
  backend here) — each surfaced through the normal localized error states,
  never as unhandled failures.
- API-failure SSR behavior: with no backend reachable, Server-mode product
  fetches fail gracefully into localized not-found/error UX; prerendered
  pages serve idle shells that load-or-fail live in the browser. No route
  crashed SSR and no failure detail leaked beyond localized copy.

## 5. Browser-only API audit (prod sources)

All usages are platform-guarded (`isPlatformBrowser(PLATFORM_ID)` first,
plus try/catch on storage), so the server always renders the
anonymous/standby variant and hydration never mismatches on stored values:

```text
libs/i18n  culture.service      window.localStorage / window.navigator guarded
libs/theming theme.service      window.localStorage / document guarded
libs/auth  token-storage        window.localStorage guarded (access token
                                memory-only; refresh persisted versioned)
storefront guest-cart-storage   window.localStorage guarded (opaque cartId only)
storefront stripe provider      PLATFORM_ID-guarded; server initialize is no-op,
                                createElements/mount reject off-browser
shells/layouts                  no window/document/localStorage (arch-pinned)
states/pages                    no direct browser APIs; effects use
                                isBrowser guards / afterNextRender
```

## 6. Server/client state consistency & duplicate requests

- Catalog/categories: data effects return early off-browser and `ngOnInit`
  reloads browser-only — the server never fetches, so hydration cannot
  duplicate requests (client issues exactly one request per query).
- Product details: the route-id effect runs on both platforms; the server
  stores settled payloads into `TransferState` (server-only writes, failures
  never stored) and the browser consumes each key once (`remove` on read).
  Covered by the existing server/client `TransferState` pair specs — no
  hydration refetch of transferred data, no stale reuse.
- Orders/account/payment pages: loads trigger from browser-only
  `afterNextRender` — server never fetches authenticated resources.
- Live success-path transfer (server 200 → zero client refetch) could not be
  observed here (no backend); re-confirmation against a live backend belongs
  to 11.13. Design + unit coverage give no reason to expect duplication.

## 7. Private-data exposure: none found

- All SSR HTML renders the anonymous shell (Login/Register links, no user
  name, no order/payment/cart contents). Session restore reads
  `localStorage` browser-only, so the server can never personalize HTML.
- Secret scan of every probed SSR response (`sk_test/sk_live/whsec_/
  refreshToken/accessToken/cartId/pk_test`): zero hits. The publishable
  Stripe key lives in the client bundle by design (public), never in SSR HTML.

## 8. Findings (no fix in this sub-phase — owning sub-phases noted)

```text
F-11.2-1 (→ 11.12/11.13, sharpens G12): `security.allowedHosts` is `[]`,
      so the prod SSR server answers every request `400 Header "host" …
      is not allowed` unless hosts are supplied at runtime (verified:
      NG_ALLOWED_HOSTS=localhost,127.0.0.1 restores 200s). Deployment must
      provide NG_ALLOWED_HOSTS (or bake hosts); do not use "*".
F-11.2-2 (→ 11.11, sharpens G09): unknown URLs (e.g. /does-not-exist-xyz)
      return raw Express `Cannot GET …` (404, 157 bytes, no Angular HTML) —
      the client-side `** → NotFoundPage` route never renders server-side
      on direct navigation. In-app unknown navigation is unaffected.
```

## 9. Definition of Done (§11.2 acceptance — item-by-item)

```text
[x] Server-side rendering verified (prod artifact, §3)
[x] Meaningful HTML generated on the server (home content, catalog shell
    + metadata, live product fetch with graceful failure UX, §3–§4)
[x] Hydration succeeds with no hydration errors/mismatches (Chromium, §4)
[x] Browser-only API usage reviewed (window/document/localStorage/
    sessionStorage + other APIs, all guarded, §5)
[x] SSR-safe services/utilities verified (§5)
[x] Server/client state consistency verified (single-use TransferState,
    failures never stored, §6)
[x] Duplicate hydration requests checked — none by construction (§6;
    live-backend re-confirmation deferred to 11.13)
[x] Direct navigation to public SSR routes verified (§3)
[x] SSR behavior for invalid routes verified (finding F-11.2-2 → 11.11)
[x] SSR behavior when required API requests fail verified (graceful, §4)
[x] No authenticated/private data exposed through SSR (§7)
```

Flow `HTTP Request → SSR HTML → Hydration → Interactive Application` holds
for all supported routes. No code changes were required; the 11.1 test
baseline (arch 102/102, storefront 115/1321, libs 56/390, admin 8/20,
production build green) still stands.

Next: **Sub-Phase 11.3 — SEO Metadata**, consuming the §3 metadata evidence
(static index title, per-page Title/Meta coverage) and finding F-11.2-2
(unknown resources must not emit misleading metadata).
