# Phase 0 — Frontend Foundation + Testing: Completion Report

Status: **Complete** — 2026-09-05.

Phase 0 established the Angular 22 workspace baseline for FluxCommerce:
a stable, testable, architecturally aligned frontend foundation with no
business features. All twelve sub-phases (0.1–0.12) are done in dependency
order, all acceptance criteria are satisfied, and the project is ready for
**Phase 1 — Core Infrastructure**.

Related references: `docs/PROJECT_CONTEXT.md` (§21),
`docs/ARCHITECTURE.md`, `docs/phases/PHASE_0_FRONTEND_FOUNDATION_AND_TESTING.md`.

---

## 1. Sub-phase summary

```text
0.1  Workspace Initialization
     Strict TypeScript, standalone schematics defaults, workspace scripts,
     clean --no-create-application baseline.

0.2  Multi-Application Workspace
     apps/storefront + apps/admin (CSR shells, ports 4200/4201), independent
     build/serve targets, per-app scripts. No routing, no tests yet.

0.3  Shared Libraries Foundation
     libs/api, auth, ui, i18n, theming, models, utils — source libraries with
     barrel entry points, @flux/* path mappings, minimal typed foundations.

0.4  Architecture & Dependency Boundaries
     ESLint boundary rules (no cross-app imports, barrel-only lib access,
     libs never import apps), negative-tested. Direction: apps -> libs.

0.5  Application Shell & Routing Foundation
     core/layout/features conventions, standalone routing with eager shells
     and lazy pages, 404 fallback, per-app app.routes.ts.

0.6  Storefront SSR Foundation
     SSR + hydration for storefront (schematic-exact files, Express server,
     prerender), admin stays CSR. Runtime SSR verified (HTTP 200).

0.7  Environment & Application Configuration
     Typed AppEnvironment token/provider in libs/api, dev/prod environment
     files per app (dev URL from the backend contract), fileReplacements,
     public-values-only rule.

0.8  Testing Foundation
     ng test (unit-test builder) for apps, root Vitest for libs, 9 spec
     files, Playwright config with 2 apps x 3 browsers, 2 smoke specs.

0.9  CI Testing Foundation
     .github/workflows/ci.yml: install -> lint -> typecheck -> build ->
     unit -> browsers -> e2e. Fail-fast, headless, dry-run verified.

0.10 Architectural Verification
     scripts/verify-architecture.mjs: 25 automated checks, all passing.

0.11 Foundation Quality & Cleanup
     Full audit (deps, files, barrels, configs), worker-flake root-caused
     and fixed, hydration console probe, zero leftover debt.

0.12 Completion & Documentation
     This report, PROJECT_CONTEXT synchronization, final sign-off.
```

No business features, auth flows, interceptors, or Phase 1 code were
introduced in any sub-phase.

---

## 2. Final workspace status

```text
apps/
├── storefront/          # SSR (server + prerender + hydration), port 4200
│   └── src/app/{core,layout,features,app.routes.ts}
│   └── src/{main.ts,main.server.ts,server.ts,environments/}
└── admin/               # CSR only, port 4201
    └── src/app/{core,layout,features,app.routes.ts}
    └── src/{main.ts,environments/}

libs/
├── api/                 # ApiConfig, buildApiUrl, AppEnvironment + provider
├── auth/                # AuthStatus, CurrentUser (no workflows)
├── ui/                  # ComponentSize (no components yet)
├── i18n/                # Culture en/fr/de/es/ar + helpers (Phase 4 owns workflows)
├── theming/             # Theme + constants (Phase 3 owns the system)
├── models/              # EntityId, IsoDateString
└── utils/               # isDefined (generic only)

e2e/                      # storefront + admin smoke specs
scripts/                  # verify-architecture.mjs (25 checks)
.github/workflows/ci.yml # install -> lint -> typecheck -> build -> unit -> e2e
```

Toolchain (pinned): Angular CLI 22.1.7, Angular 22.1.5, TypeScript 6.0.3,
Node 24.18.0, Vitest 4.0.8, Playwright 1.62.1, ESLint 10.10.0.

---

## 3. Final verification results (2026-09-05, exit 0 throughout)

| Check               | Command                       | Result                                                  |
| ------------------- | ----------------------------- | ------------------------------------------------------- |
| Format + boundaries | `npm run lint`                | 0 errors, 0 warnings                                    |
| Typecheck           | `npm run typecheck`           | apps + 7 libs + specs, 0 errors                         |
| Architecture audit  | `npm run verify:architecture` | **25/25 PASS**                                          |
| Storefront build    | `npm run build:storefront`    | client + server bundles + 1 prerendered route, 0 errors |
| Admin build         | `npm run build:admin`         | CSR bundles, 0 errors                                   |
| Unit/component      | `npm run test:unit`           | **13/13** (4 storefront + 4 admin + 5 libs)             |
| E2E smoke           | `npm run test:e2e`            | **6/6** (2 apps x chromium/firefox/webkit)              |

SSR runtime additionally verified: built server returns HTTP 200 with
server-rendered markup and hydration markers, zero console errors or
warnings; unknown direct URLs return HTTP 404 (Express default — correct),
while in-app navigation renders the Angular 404 fallback page.

---

## 4. Key engineering decisions

- **Source libraries over packaging**: `libs/*` are path-mapped source
  with barrel entry points; no ng-packagr. Full packaging/boundaries
  tooling arrives only if a later phase demonstrates the need.
- **TS path mappings without `baseUrl`**: `moduleResolution: bundler`
  plus `./`-prefixed mapping values. The deprecated `baseUrl` was removed
  entirely (TS 7-proof); a prior silencer approach was discarded.
- **Schematic-exact SSR**: `ng add @angular/ssr` could not resolve package
  metadata, so its v22.1 file set, target options, scripts and pinned
  dependency versions were replicated verbatim from its sources instead of
  hand-rolled. `allowedHosts: []` (deny-by-default) is kept; local preview
  authorizes via `NG_ALLOWED_HOSTS`.
- **Backend contract is the source of URLs**: dev `apiBaseUrl`
  (`https://localhost:7119`) comes from `docs/frontend-contract/`;
  production defaults to same-origin `/api`. Environments hold public
  values only — verified by audit.
- **Two Vitest runners, one convention**: `ng test` (unit-test builder)
  for app component tests, root Vitest for pure lib tests; explicit
  `vitest` imports in specs (globals break under some editor project
  resolutions); threads pool with a single worker after root-causing
  tinypool 5s worker-startup timeouts under load.
- **Dead config is debt**: two candidate fixes that evidence contradicted
  (`singleThread`/`minWorkers`, which do not exist in Vitest 4) were
  removed rather than kept as placebos.
- **Audit script discipline**: the verifier failed closed on a glob-eating
  comment-strip bug during its own development; JSONC parsing is now
  anchored and loud on unexpected input.

---

## 5. Phase 0 acceptance criteria (per §4.12)

- All sub-phase acceptance criteria are satisfied — yes (§1).
- Both applications build successfully — yes (§3).
- Storefront SSR works — yes, build + prerender + runtime (§3).
- Admin CSR works — yes, CSR-only bundles and smoke tests (§3).
- Shared libraries exist with correct boundaries — yes, 7 libs, audit 25/25 (§3).
- Architecture verification passes — yes, audit 25/25, no violations remain.
- Unit/component tests pass — yes, 13/13.
- E2E smoke tests pass — yes, 6/6.
- CI verification passes — pipeline defined and dry-run green step by step
  (install, lint, typecheck, builds, unit, e2e, all exit 0); GitHub
  execution awaits the first push/PR run.
- Documentation is synchronized — this report plus PROJECT_CONTEXT §21.

---

## 6. ARCHITECTURE.md

No changes required. Implementation introduced no justified deviations:
same workspace layout, same library boundaries, same dependency direction,
same SSR/CSR split, same testing stack as specified. The document remains
the accurate baseline for Phase 1.

---

## 7. Ready for Phase 1 — Core Infrastructure

Phase 1 inherits: typed app configuration access (`APP_ENVIRONMENT`),
library boundaries with enforcement, per-app routing shells, SSR-safe
storefront foundation, and a green build/test/CI baseline. It can focus on
HTTP client infrastructure, interceptors, error normalization,
cancellation, pagination and resource-state patterns without revisiting
workspace architecture. No commerce workflows exist yet — by design.
