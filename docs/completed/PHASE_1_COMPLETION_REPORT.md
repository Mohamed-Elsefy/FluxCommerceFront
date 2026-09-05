# Phase 1 — Core Infrastructure: Completion Report

Status: **Complete** — 2026-09-05.

Phase 1 established the shared frontend infrastructure for reliable
communication between the Angular applications and the ASP.NET Core backend,
built on the API contracts in `docs/frontend-contract/` (which remain the
source of truth; no separate contract package was introduced). All thirteen
sub-phases (1.1–1.13) are done in dependency order, all completion criteria
are satisfied, and the project is ready for **Phase 2 — Identity &
Authentication**.

Related references: `docs/PROJECT_CONTEXT.md` (§22),
`docs/ARCHITECTURE.md`, `docs/phases/PHASE_1_CORE_INFRASTRUCTURE.md`,
`docs/frontend-contract/`.

---

## 1. Sub-phase summary

```text
1.1  API Contract Integration Foundation
     Contract analysis of docs/frontend-contract/ (endpoints, methods, DTOs,
     query/pagination, status codes, error catalog, enums-as-numbers wire
     rule). TypeScript mirrors: domain DTOs in libs/models (common/ +
     domains/ per backend module), transport envelopes + endpoint catalog in
     libs/api. Manual-mirror sync rule documented; no codegen.

1.2  HttpClient & API Configuration
     provideApi() composes provideHttpClient() (FetchBackend default,
     SSR-safe; deprecated withFetch() removed) with API_BASE_URL resolved
     from APP_ENVIRONMENT. Dev origin vs prod same-origin /api without
     feature branching. Request-context vocabulary (correlation/culture/
     idempotency HttpContext slots).

1.3  Typed API Client Architecture
     ApiClient (Feature Data Access -> API Client -> HttpClient) with
     get/post/put/patch/delete, path interpolation, deterministic query
     serialization, unknown-typed bodies, envelope-agnostic responses.
     Raw HttpClient banned in features via ESLint + architecture script
     (both negative-tested).

1.4  HTTP Interceptor Pipeline
     Ordered functional pipeline: correlation -> request-config -> auth
     hook -> error hook. ACCESS_TOKEN_PROVIDER seam (default null, inert
     until Phase 2). No workflows, no normalization yet.

1.5  API Error Normalization
     ApiError (status/code/message/validationErrors/correlationId/traceId),
     ProblemDetail parsing with honest best-effort codes (extensions.code
     is {} on the wire), client-synthesized transport codes, silent
     cancellation classification. Integrated into the error hook.

1.6  Correlation & Request Context
     Ownership (client flow-id wins, else per-request UUID; backend echoes),
     always-send X-Correlation-ID, echo/request-id extraction onto ApiError.

1.7  Request Cancellation & Lifecycle
     destroySignal() + cancelOnAbort() + ApiClient signal option. Aborts
     complete silently (never errors); switchMap replacement drops stale
     responses. No lifecycle operators beyond this.

1.8  Query Parameters & Pagination Abstractions
     PaginationRequest + normalizePagination (contract defaults/clamps),
     SortQuery, toQueryParams funnel (typed interfaces lack index
     signatures), buildQueryString/toHttpParams sharing one core so both
     outputs stay wire-identical. PagingQuery kept as alias.

1.9  Resource State Architecture
     ResourceState<T> (idle/loading/success/empty/error + flags, data
     retention), local createResourceState() (no global store),
     loadResourceState() composing client + normalizer + cancellation.
     Emptiness is feature-owned by design.

1.10 Common Async UI States
     libs/ui async-state/: LoadingIndicator, Skeleton, EmptyState,
     ErrorState, RetryButton — standalone, OnPush, presentation-only
     (@Input/@Output), SSR/CSR-safe, logical properties, currentColor
     styling. Features own triggers, copy, and retry actions.

1.11 Real Backend Integration Slice
     GET /catalog/products vertical slice (client -> interceptors ->
     resource store -> UI primitives) against contract-exact mock handlers
     (no live backend reachable): success/loading/empty, 400 field errors,
     404/409 normalization, code extraction, correlation traceability,
     silent cancellation, error -> retry -> success. No business modules
     shipped. Required vitest resolve.alias for @flux/* in raw Vitest runs.

1.12 Testing & Architectural Verification
     Closed coverage gaps (pager math, error guards, endpoint builder, 201,
     401). Added circular-import detection (relative graph + @flux lib
     graph, specs excluded) — both negative-tested. Suite: 21 lib files,
     118 tests; 8 app tests; 29 architecture checks.

1.13 Phase Hardening & Documentation
     noUnusedLocals clean across libs/api, models, ui; removed one dead
     import; corrected six stale forward-looking comments; confirmed no
     browser-only APIs in libs, no secrets, SSR/CSR boundaries intact;
     this report + PROJECT_CONTEXT synchronization.
```

No login/registration/token lifecycle, guards, catalog/cart/checkout/orders/
payments features, or global server-data stores were introduced in any
sub-phase.

---

## 2. Final workspace status

```text
libs/
├── api/src/lib/
│   ├── client/          # ApiClient, provideApi, API_BASE_URL, config, env
│   ├── contracts/       # envelopes, ProblemDetails, headers, endpoint catalog
│   ├── interceptors/    # correlation, request-config, auth hook, error hook
│   ├── runtime/         # normalizer, query, context, correlation, lifecycle, state
│   └── integration/     # catalog-slice proof (specs only, no business code)
├── models/src/lib/
│   ├── common/          # Guid, IsoDateString, wire enums, role/status types
│   └── domains/         # identity, catalog, cart, orders, inventory, payments
├── ui/src/lib/
│   ├── async-state/     # loading, skeleton, empty, error, retry primitives
│   └── ui-primitives.ts # ComponentSize
├── auth/i18n/theming/utils  # unchanged foundations (workflows belong to later phases)

e2e/                      # storefront + admin smoke specs (unchanged)
scripts/                  # verify-architecture.mjs (29 checks)
vitest.config.ts          # @flux/* aliases for raw Vitest runs
```

Layering (enforced by lint + script, both negative-tested):

```text
Component -> Feature Data Access -> ApiClient -> HttpClient -> interceptors -> API
```

---

## 3. Final verification results (2026-09-05, exit 0 throughout)

| Check               | Command                       | Result                                                     |
| ------------------- | ----------------------------- | ---------------------------------------------------------- |
| Boundaries          | `npm run lint:boundaries`     | 0 errors                                                   |
| Formatting          | prettier check (touched files)| all pass (see note below)                                  |
| Typecheck           | `npm run typecheck`           | apps + 7 libs + specs, 0 errors                            |
| Architecture audit  | `npm run verify:architecture` | **29/29 PASS** (incl. 2 cycle checks)                      |
| Storefront build    | `npm run build:storefront`    | client + server bundles + 1 prerendered route, 0 errors    |
| Admin build         | `npm run build:admin`         | CSR bundles, 0 errors                                      |
| Unit/component      | `npm run test:unit`           | **126/126** (8 apps + 118 libs)                            |
| E2E smoke           | `npm run test:e2e`            | **6/6** (2 apps x chromium/firefox/webkit)                 |

Formatting note (pre-existing, out of scope): repo-wide `prettier --check`
flags untouched files because this checkout uses `core.autocrlf=true`
(CRLF working tree vs LF blobs + Prettier default). Every file touched in
Phase 1 is LF and check-clean; `lint:boundaries` (the rule check) is fully
green. On an LF checkout the format check is unaffected by Phase 1.

---

## 4. Key engineering decisions

- **Numeric wire enums, strings where the backend stringifies**: no
  `JsonStringEnumConverter` on the backend, so enum bodies/responses are
  numbers — except `OrderStatus`/`PaymentStatus` (`.ToString()`). The
  illustrative string unions in the contract docs were deliberately not
  copied for enum fields.
- **Manual mirrors, no codegen**: the contract ships as docs + C# records;
  generated output belongs in `libs/api/.../generated/` only if OpenAPI
  generation is ever adopted (documented, not built).
- **Fetch default, no `withFetch()`**: `FetchBackend` is the default
  `HttpBackend`; the deprecated flag was removed after the deprecation
  surfaced.
- **Honest error codes**: `extensions.code` is `{}` on the wire, so `code`
  is best-effort; features branch on `code`-then-`status`, never `message`.
  Transport codes are stable non-colliding singles for `libs/i18n` (Phase 4).
- **Correlation ownership**: client flow-id wins, else per-request UUID;
  backend echoes; sent id is the trace key on `ApiError`.
- **Silent cancellation**: aborts complete without error and leave state
  untouched; `switchMap` (not a custom operator) owns race replacement.
- **Feature-owned emptiness/query normalization**: the store/normalizer
  cannot infer domain emptiness or intent — proven by failing tests during
  1.11, fixed by explicit predicates, not framework magic.
- **`@Input()`/`@Output()` in `libs/ui`**: raw Vitest lacks the Angular
  compiler transform that registers signal inputs (proven: defaults render,
  bindings fail); decorator metadata stays runtime-readable. App specs
  (Angular builder) are unaffected.
- **Vitest `@flux/*` aliases**: raw Vitest does not read `tsconfig.json`
  paths; the config now mirrors them. Verified harmless to `ng test`.
- **Cycle detection excludes specs**: test-only cross-lib seams (e.g. the
  1.11 slice importing `@flux/ui`) must not fail production checks.
- **Reserved surface kept deliberately**: endpoint catalog, header types,
  and enum display helpers show zero production consumers yet — they are
  the 1.1/contract deliverables for Phases 2, 5–7, 12–14, not dead code
  (verified used-or-reserved per symbol in 1.13).

---

## 5. Phase 1 acceptance criteria (per §7)

- Contracts integrated into the frontend workflow — yes (§1: 1.1).
- `HttpClient` centrally configured — yes (§1: 1.2, both apps via `provideApi()`).
- Storefront and Admin share the infrastructure; base URLs centrally managed;
  features touch no raw URLs — yes (boundary enforced, negative-tested).
- Typed API client architecture — yes (§1: 1.3).
- Functional interceptors with auth hooks but no workflows — yes (§1: 1.4).
- Errors normalized; ProblemDetails handled per contract; stable codes
  preserved — yes (§1: 1.5).
- Correlation/request context supported — yes (§1: 1.6).
- Lifecycle-safe cancellation — yes (§1: 1.7).
- Query/pagination follows backend contracts — yes (§1: 1.8).
- Consistent resource state — yes (§1: 1.9).
- Loading/empty/error UI primitives — yes (§1: 1.10).
- Real backend integration slice working — yes against contract-exact
  handlers (no live backend reachable; §1: 1.11).
- Unit + HTTP tests pass — yes, 126/126 (§3).
- Architecture verification passes — yes, 29/29 (§3).
- Both builds pass; SSR/hydration healthy (build + prerender + smoke E2E
  against served SSR app); existing E2E healthy — yes (§3).
- Lint and typecheck pass — yes (§3 + note).
- Documentation synchronized — this report plus PROJECT_CONTEXT §22.

---

## 6. ARCHITECTURE.md

No changes required. Implementation introduced no justified deviations:
same workspace layout (internal `libs/*` subfolders are below the
document's abstraction level), same 7 libraries, same dependency direction
(`Component -> Feature Data Access -> API Client -> HttpClient`, now
additionally enforced), same SSR/CSR split, same testing stack. The
document remains the accurate baseline for Phase 2.

---

## 7. Ready for Phase 2 — Identity & Authentication

Phase 2 inherits: contract mirrors for all identity DTOs, `ApiClient` with
typed auth endpoint paths (`IDENTITY_ENDPOINTS`), an inert-until-provided
`ACCESS_TOKEN_PROVIDER` seam, 401 normalization (no behavior), correlation
and cancellation plumbed, resource-state + async-UI patterns for
login/register forms, and a green build/test/CI baseline. It can implement
login, registration, token lifecycle, guards, and session state without
revisiting HTTP infrastructure. No commerce workflows exist yet — by design.
