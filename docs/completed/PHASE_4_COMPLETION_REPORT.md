# Phase 4 — Localization & Culture Management: Completion Report

Status: **Complete** — 2026-09-10.

Phase 4 establishes the centralized, reusable localization and
culture-management infrastructure for the FluxCommerce Angular frontend:
one culture platform in `libs/i18n` consumed through the Phase 1 HTTP
infrastructure and the Phase 3 RTL foundation. All eight sub-phases
(4.1–4.8) are done in dependency order, all completion criteria are
satisfied, and the project is ready for **Phase 5 — Catalog & Product
Discovery**.

Related references: `docs/PROJECT_CONTEXT.md` (§25),
`docs/ARCHITECTURE.md` (§§6, 15),
`docs/phases/PHASE_4_LOCALIZATION_AND_CULTURE_MANAGEMENT.md`,
`docs/adr/009–011`.

---

## 1. Sub-phase summary

```text
4.1  Culture Model & Supported Cultures
     libs/i18n culture.ts: Culture, CultureMetadata, the single
     SUPPORTED_CULTURE_METADATA registry (en/fr/de/es/ar, ar → rtl),
     DEFAULT_CULTURE (en), centralized validation (isSupportedCulture /
     parseCulture / resolveCulture) and direction resolution. Pure,
     SSR-safe, no duplication.

4.2  Translation Resource System
     translation-model.ts (nested-dictionary model, namespace.group.key
     convention), translation-dictionaries.ts (bundled base resources for
     all five cultures, identical key sets), translations.ts
     (synchronous loading, nested lookup, {param} interpolation,
     deterministic fallback target → en → key path). Business-agnostic.

4.3  Culture State & Language Switching
     culture.service.ts: CultureService (culture/supportedCultures/
     initialized signals), persisted → browser → default precedence,
     guarded localStorage persistence, synchronous setCulture without
     page reloads, provideCulture() bootstrap initializer. Composed in
     both apps. SSR-safe by platform guards (server settles to default).

4.4  Localization & Direction Integration
     CultureService.direction (computed, never stored — no duplicate
     direction state) plus single-writer root dir application, consuming
     the Phase 3 logical-property mechanism untouched. en → ar flips to
     RTL at runtime, ar → en back to LTR, no reloads, no reimplementation.

4.5  Backend Culture Synchronization
     ACTIVE_CULTURE_PROVIDER seam in libs/api (mirroring
     ACCESS_TOKEN_PROVIDER); requestConfigInterceptor stays the single
     Accept-Language writer (explicit per-request context wins, direct
     headers never clobbered, ambient culture read per request);
     provideCulturePropagation() binds the seam to CultureService in
     both apps. Features never touch headers.

4.6  Formatting & Localized Validation
     formatting.ts: formatDate/formatNumber/formatCurrency over Intl
     (ar renders Arabic-Indic digits via ar-u-nu-arab; Gregorian
     calendar unchanged); validation-errors.ts resolves Angular
     ValidationErrors to common.validation.* with stable priority;
     maxLength/email/min/max resources added in all five cultures.
     Business messages stay feature-owned.

4.7  API Error Localization
     error-localization.ts: stable-code → errors.* mapping (exact then
     case-insensitive), codeless 401/403/validation-400 resolution by
     status and shape, deterministic errors.unknown fallback. UI copy
     comes exclusively from codes via the resolver — server text is
     never branched on. errors.validation resources added in all five
     cultures. Domain codes stay unmapped until their features own them.

4.8  SSR, Hydration & End-to-End Validation (this sub-phase)
     Server neutrality proven (SSR emits no dir; browser reconciles at
     bootstrap); composed CultureService → HTTP integration spec;
     culture lifecycle E2E on both apps (SSR, hydration, switching,
     reload persistence, Accept-Language propagation); this report;
     PROJECT_CONTEXT.md §25 status; ARCHITECTURE.md §§6/15 as-built
     sync; ADRs 009 (infrastructure), 010 (direction coupling), 011
     (SSR hydration safety).
```

---

## 2. Final workspace status

```text
libs/i18n (localization platform: culture, translations ×3,
           culture.service, culture-propagation, formatting,
           validation-errors, error-localization)
libs/api  (+ ACTIVE_CULTURE_PROVIDER seam; requestConfigInterceptor
           ambient-culture fallback; culture→HTTP integration spec)
apps/storefront + apps/admin (provideCulture() +
           provideCulturePropagation() at bootstrap; no feature code)
e2e/culture.spec.ts (lifecycle suite ×2 chromium projects)
Guardrails  eslint.config.mjs (per-scope boundaries) +
            scripts/verify-architecture.mjs (97 checks)
```

---

## 3. Final verification results (2026-09-10, exit 0 throughout)

```text
npm run lint                  prettier + ESLint boundaries — 0 errors
npm run typecheck             apps + 7 libs + specs — 0 errors
npm run build:storefront      SSR + 7 prerendered routes — 0 errors
npm run build:admin           CSR — 0 errors
npm run test:unit:apps        storefront 16 files/63 tests, admin 8/20 — 100%
npm run test:unit:libs        55 files/352 tests — 100% (i18n 77:
                              culture 14, translations 17,
                              culture.service 18, culture-propagation 1,
                              formatting 12, validation-errors 7,
                              error-localization 8; api culture
                              propagation 3)
verify-architecture.mjs       97/97 checks
npm run test:e2e              41 tests: 40 passed, 1 skipped — 100%
                              (culture lifecycle 9 passed + 1 intentional
                              skip of the SSR test on CSR-only admin;
                              storefront matrix, auth lifecycles, admin
                              access control all green)
```

---

## 4. Key engineering decisions

- Pure data/functions first: cultures, dictionaries, lookup, formatting,
  and resolvers are total functions of explicit inputs — SSR-safe by
  construction, testable without TestBed.
- Exactly one state owner (`CultureService`) and one writer per shared
  output (`dir`, `Accept-Language`) — duplication is structurally
  impossible, not merely discouraged.
- Backend propagation reuses the Phase 1 provider-seam pattern instead
  of a new mechanism: `libs/api` never imports culture state.
- Bare-`ar` selects Latin digits per CLDR, so formatting maps `ar` to
  `ar-u-nu-arab` (Arabic-Indic digits, Gregorian calendar kept) —
  verified empirically against the runtime ICU, then pinned in tests.
- Unknown inputs degrade deterministically (default culture, key path,
  generic error message) instead of crashing rendering.
- E2E honesty: culture switching has no UI surface yet, so lifecycle
  tests drive `localStorage` + reload and assert the real shell,
  pipeline, and headers; rendering coverage for translations/formatting
  stays at unit/integration level until owning features exist.

---

## 5. Phase 4 acceptance criteria (per phase §4.8 plus final definition of done)

```text
[x] Five supported cultures centrally defined (4.1)
[x] Current culture managed through a centralized abstraction (4.3)
[x] Runtime language switching without reloads (4.3, E2E proof)
[x] Persistence and initialization implemented (4.3, E2E proof)
[x] Translation resources loadable and resolvable (4.2)
[x] Interpolation works (4.2)
[x] Missing-key and fallback behavior deterministic (4.2)
[x] Culture changes integrate with the Phase 3 direction system (4.4)
[x] Arabic → RTL, all others → LTR (4.1/4.4, unit + E2E proof)
[x] Current culture propagated via existing HTTP infrastructure (4.5)
[x] Date, number, currency formatting culture-aware (4.6, incl. Arabic)
[x] Common validation messages localized (4.6)
[x] Normalized API errors resolve to localized messages (4.7)
[x] SSR and hydration culture-consistent (4.8, E2E proof)
[x] No feature coupling; no Phase 3 infrastructure duplicated
[x] Unit, integration, SSR, E2E, typecheck, lint, build, architecture pass
[x] Infrastructure ready for Catalog, Cart, Orders, Payments, Admin
```

---

## 6. Known limitations

- `test:e2e` needs the dev servers + Playwright browsers; the full run
  takes minutes (backend-independent by stub design — no live API needed).
- `ar` date/number output follows the runtime ICU via `ar-u-nu-arab`;
  exotic environments with small-ICU builds may render fewer Arabic
  glyphs — Node 24 and all Playwright browsers ship full ICU.
- The admin SSR E2E case is intentionally skipped (admin is CSR-only by
  architecture); all other culture tests run on both apps.
- A pre-existing failure was repaired en route: `apps/admin`
  `index.html` titled the app `Flux Commerce`, failing the long-standing
  `admin loads successfully` expectation of `Admin` (broken since app
  initialization, unrelated to Phase 4). One-line title fix; disclosed,
  not a feature.

---

## 7. Deferred work (explicit non-goals)

```text
Phase 5+ — Catalog/Product discovery and all business features with
           their feature-owned translations, validations, and errors
Domain error resources (Identity.*, Cart.*, Order.*, …) — with owners
Culture switcher UI — with the first consumer feature
Cookie-negotiated SSR locale rendering (server stays neutral)
```

---

## 8. Documentation changes in this sub-phase

```text
docs/completed/PHASE_4_COMPLETION_REPORT.md   created (this file)
docs/PROJECT_CONTEXT.md                       §25 marked Complete + deliverable
docs/ARCHITECTURE.md                          §6 (libs/i18n) and §15 as-built sync
docs/adr/009-localization-infrastructure.md   created
docs/adr/010-culture-direction-coupling.md    created
docs/adr/011-ssr-hydration-safety.md          created
e2e/culture.spec.ts + playwright projects     created (lifecycle suite)
libs/api/.../culture-propagation.spec.ts      created (composed integration)
```
