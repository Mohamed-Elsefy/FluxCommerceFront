# Phase 2 — Identity & Authentication: Completion Report

Status: **Complete** — 2026-09-09.

Phase 2 establishes Identity & Authentication as a first-class frontend
platform capability on top of the Phase 1 infrastructure, consuming the
backend contracts in `docs/frontend-contract/` (which remain the source
of truth; no parallel contracts were introduced). All sixteen sub-phases
(2.1–2.16) are done in dependency order, all completion criteria are
satisfied, and the project is ready for **Phase 3 — Storefront
Foundations & UI System**.

Related references: `docs/PROJECT_CONTEXT.md` (§23),
`docs/ARCHITECTURE.md` (§§6, 11),
`docs/phases/PHASE_2_IDENTITY_AUTHENTICATION_IMPLEMENTATION_PLAN.md`,
`docs/frontend-contract/`, `docs/adr/001–004`.

---

## 1. Sub-phase summary

```text
2.1  Identity Contract Integration
     Identity DTOs already mirrored in libs/models (§1.1); added
     IdentityApiService in libs/api — 10 thin typed methods over the
     Phase 1 ApiClient using IDENTITY_ENDPOINTS (no unwrapping, no error
     remapping, no token handling). Barrel-exported.

2.2  Authentication State & Session Foundation
     Central AuthService in libs/auth: AuthState
     (initializing|anonymous|authenticated), AuthSession (metadata only),
     CurrentUser, readonly signals + computed selectors (status,
     isInitializing, currentUser, roles, hasRole(), isAdmin). Strict
     deterministic transitions; sole writer of auth state.

2.3  Token Storage & Session Model
     TokenStorageService + TOKEN_STORAGE seam in libs/auth: refresh token
     + user snapshot persisted to versioned localStorage key; access JWT
     memory-only. Platform-guarded (server: reads null, writes no-op) and
     exception-safe. Security tradeoffs documented inline (XSS posture,
     no-cookie rationale, lifetimes).

2.4  Login & Registration
     Storefront features/auth vertical slice: AuthDataAccess orchestration
     (login → session → me → authenticated; register → pending result,
     never auto-login), typed reactive forms mirroring backend validation,
     server-error mapping (C# keys → controls), loading/error states on
     shared UI primitives. Routes /login + /register.

2.5  Access Token Integration
     provideAccessToken() binds AuthService.readAccessToken() to the Phase
     1 ACCESS_TOKEN_PROVIDER seam in both apps. Login-time explicit Bearer
     removed: every session request now flows through central injection.

2.6  Refresh Token Lifecycle
     TokenRefreshService in libs/auth (placement avoids an api↔auth barrel
     cycle): single-flight shared execution, rotated-pair publication,
     never-throwing boolean contract, logout-race safe, plus
     isRefreshRequest() for pipeline exclusion.

2.7  Centralized 401 Recovery
     authRecoveryInterceptor in libs/api between request-config and
     injection (retries re-enter Bearer attachment): eligible normalized
     401s only, login/register/refresh excluded by URL, max one retry per
     request (WeakSet), provider faults fall back to the original error,
     teardown-safe. Wired via provideAuthRecovery() in both apps.

2.8  Session Restoration & Current User
     SessionRestoreService + non-blocking APP_INITIALIZER in both apps:
     storageless boots settle synchronously to anonymous; stored sessions
     refresh → hydrate via GET /auth/me → authenticated (404/401/dataless
     tear down, transient profile failures keep the refreshed session).
     AuthService.initialized is the documented guard-wait primitive.

2.9  Logout & Session Cleanup
     AuthService.logout(): backend revoke → total cleanup (storage,
     memory, user, derived signals) → redirect (default /, same-origin
     guarded). Backend failures still clear and redirect; never errors.

2.10 Email Verification & Password Recovery
     Entry pages /verify-email (token auto-verify), /resend-verification
     (emailSent-branched copy), /forgot-password (unconditional success,
     anti-enumeration), /reset-password (token + policy password +
     local confirmation; contract-exact body). None establish sessions;
     all prompt login afterwards. Login/register cross-links added.

2.11 Authentication Guards
     Functional authGuard in libs/auth: authenticated allows; anonymous
     returns a /login?returnUrl= UrlTree; initializing defers exactly once
     (never mistaken for anonymous).

2.12 Role Guards & Admin Foundation
     Functional roleGuard (route data.roles, OR semantics, strict claims,
     fail-closed, init-aware) redirecting to /forbidden. Admin app gains a
     lazy /forbidden page and a guarded /dashboard stub entry
     (authGuard + roleGuard, roles Admin/SuperAdmin); public root untouched.

2.13 Authentication UI Integration
     Shared AuthNav widget in libs/auth (state-driven Login/Register vs
     user/Account/Logout, initializing placeholder, logout progress),
     embedded in both shells with per-app route inputs. No design system.

2.14 Testing & Security Verification
     Closed the gaps: AuthNav unit tests, full-pipeline concurrency tests
     (3×401 → 1 refresh → 3 retried successes), secret-hygiene
     regressions (no passwords/access tokens persisted, silent storage,
     no credential echo, leak-free UI), and mocked-transport E2E suites
     (storefront lifecycle ×6, admin access ×4) with hydration-safe
     fills. No live backend exists in this environment (ECONNREFUSED),
     so transports are contract-exact fulfillments.

2.15 SSR, Security & Production Verification
     Static audit (single Bearer site, guarded storage only, passwords
     into DTOs only); production SSR bundle served and swept (7 routes
     200, zero leaked user content, silent server log); browser hydration
     audit 8/8 with zero console/page/hydration errors incl. 3× repeated
     returning-user reconciliation; mid-flight unsubscribe race test.
     Temporary harness fully reverted.

2.16 Documentation & Phase Completion
     This report, PROJECT_CONTEXT §23 status, ARCHITECTURE §§6/11
     as-built sync, ADRs 001–004, final sign-off runs.
```

Post-phase restructuring (no behavior change, history preserved via
`git mv`): storefront `features/auth/pages/` → per-screen folders
(`login/`, `register/`, `verify-email/`, `resend-verification/`,
`forgot-password/`, `reset-password/`); `libs/auth/src/lib/` →
`state/`, `session/`, `tokens/`, `guards/`, `components/`.

No catalog/cart/checkout/orders/payments features, no design system,
themes, RTL, i18n, OAuth/MFA/passkeys, or customer/admin dashboards were
introduced in any sub-phase.

---

## 2. Final workspace status

```text
libs/auth/src/lib/
├── state/         # auth-session (models + shared mapper), auth.service (+logout)
├── session/       # token-storage (+TOKEN_STORAGE), session-restore (+initializer)
├── tokens/        # access-token provider, refresh service, recovery provider
├── guards/        # auth.guard, role.guard
└── components/    # auth-nav shell widget
libs/api          # + identity service, recovery interceptor + seam (pipeline now 5 deep)
apps/storefront   # features/auth (6 screens, data-access, validators, routes)
apps/admin        # /dashboard (guarded stub) + /forbidden + shells with AuthNav
e2e/              # storefront-auth (6) + admin-auth (4) suites, playwright projects
docs/adr/         # 001 signals state, 002 storage/SSR, 003 refresh, 004 guards
```

Layering (enforced by lint + script):

```text
Pages -> AuthDataAccess -> IdentityApiService -> ApiClient -> HttpClient
                                           -> interceptors (recovery/injection/errors)
AuthService/TokenStorage/refresh (libs/auth, sole state owners)
```

---

## 3. Final verification results (2026-09-09, exit 0 unless noted)

| Check               | Command                       | Result                                                     |
| ------------------- | ----------------------------- | ---------------------------------------------------------- |
| Boundaries          | `npm run lint:boundaries`     | 0 errors                                                   |
| Typecheck           | `npm run typecheck`           | apps + 7 libs + specs, 0 errors                            |
| Architecture audit  | `npm run verify:architecture` | **29/29 PASS** (incl. 2 cycle checks)                      |
| Storefront build    | `npm run build:storefront`    | client + server bundles, 0 errors                          |
| Admin build         | `npm run build:admin`         | CSR bundles, 0 errors                                      |
| Unit/component      | `npm run test:unit`           | **268/268** (62 apps + 206 libs, 49 files)                 |
| E2E auth flows      | `npx playwright test` (auth)  | **10/10** (6 storefront + 4 admin, chromium)               |
| E2E smoke (legacy)  | `npx playwright test` (smoke) | 6 fail — pre-existing title mismatch (see §6)              |
| SSR/hydration audit | temp prod harness (reverted)  | **8/8**, zero console/page/hydration errors (3× repeated)  |

Formatting note (pre-existing, out of scope): repo-wide `prettier --check`
flags untouched files because this checkout uses `core.autocrlf=true`
(CRLF working tree vs LF blobs + Prettier default). Every file touched in
Phase 2 is LF and check-clean; `lint:boundaries` (the rule check) is fully
green.

---

## 4. Key engineering decisions

- **Signals over stores** (ADR-001): tri-state + snapshots need no
  state-management library; illegal transitions are no-ops.
- **Split persistence** (ADR-002): refresh token persisted, access token
  memory-only; `localStorage` chosen over cookies for lack of a backend
  cookie contract (documented, reversible).
- **Single-flight + seam recovery** (ADR-003): rotation hazards collapse
  per burst; interceptors stay auth-state-free via provider seams.
- **Guards as pure functions of state** (ADR-004): `UrlTree` returns,
  `returnUrl`/`/forbidden` conventions, fail-closed roles, strict claims.
- **Non-blocking restoration**: bootstrap never waits on the network;
  `initialized` is the single readiness signal (proven by a dedicated
  initializer auto-run test).
- **Provisional-then-hydrate login**: session opens from `LoginResponse`
  (success implies verified email) so injection serves `GET /auth/me`;
  hydration failure rolls everything back — no half-logged-in states.
- **Mocked-transport E2E**: no live backend is reachable here, so E2E
  fulfills contract-exact payloads; dropping the fulfillments runs the
  same suites live.
- **Hydration-safe test fills**: SSR-claim races wipe pre-hydration input;
  suites wait for shell settlement plus settle-window refills.
- **`@Input()` in `libs/*` components**: raw Vitest lacks the signal-input
  compiler transform (established in Phase 1, reused by `AuthNav`).

---

## 5. Phase 2 acceptance criteria (per §6)

- Authentication: login, registration, logout work (mocked-transport E2E
  + real-pipeline unit coverage; live runs pending a reachable backend) —
  yes. Current user centralized; restoration works; initialization is
  explicit — yes.
- Token lifecycle: central attachment, contract refresh, expiry-triggered
  refresh, retried originals, failure cleanup, single operation on
  concurrent 401s, loop prevention — yes (all covered by dedicated tests).
- Authorization: auth guard, role guard, protected admin foundation,
  forbidden handling work; backend authoritative — yes.
- Identity lifecycle: verify, resend, forgot, reset entry points work —
  yes.
- SSR & security: SSR-safe, stable hydration, isolated browser APIs, no
  token logging, no password persistence, centralized logic — yes.
- Testing: state, guard, HTTP auth, concurrency, integration, and E2E
  suites pass — yes (§3; smoke caveat in §6).
- Documentation: architecture/context synchronized, ADRs filed, this
  report created — yes.

---

## 6. Known limitations

- **No live backend in this environment** (`ECONNREFUSED` on
  `localhost:7119`): HTTP/E2E proof uses contract-exact fixtures and
  fulfillments. Suite bodies are backend-agnostic; point them at a live
  API to re-verify unchanged.
- **Smoke E2E titles**: the committed `index.html` rebrand (`Storefront`
 /`Admin` → `Flux Commerce`) predates this phase and its specs were not
  updated — 6 legacy smoke tests fail on title assertions. Untouched as
  out of scope; either update the specs or the titles before gating CI
  on the full matrix.
- **Admin has no login route**: anonymous deep links evaluate to the
  not-found fallback via `/login`. Cross-app sign-in routing belongs to
  a later phase.
- **Vitest threads pool** wedged intermittently on this machine
  (worker-startup timeouts); `--pool=forks` unblocks locally. No config
  was changed; CI environments are unaffected as far as observed.

---

## 7. Deferred work (explicit non-goals, unchanged from §7)

Design system, themes, RTL, i18n, catalog/product/cart/checkout/payment/
order UI, customer dashboard, admin modules, OAuth/MFA/passkeys. Phase 3
(Storefront Foundations & UI System) is next and consumes this phase's
capability instead of reimplementing authentication.

---

## 8. Documentation changes in this sub-phase

- Created `docs/completed/PHASE_2_COMPLETION_REPORT.md` (this file).
- Created `docs/adr/001-signals-auth-state.md`,
  `docs/adr/002-token-storage-ssr.md`,
  `docs/adr/003-single-flight-refresh.md`,
  `docs/adr/004-route-role-guards.md`.
- `docs/PROJECT_CONTEXT.md` §23: marked Phase 2 complete with readiness
  pointer to Phase 3.
- `docs/ARCHITECTURE.md` §§6/11: synchronized the as-built identity
  capability (services, pipeline slots, guard contracts, SSR behavior).
- `docs/phases/`: no changes required — the plan was followed as written.
