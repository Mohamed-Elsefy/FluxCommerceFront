# Phase 0 — Frontend Foundation + Testing

## 1. Purpose

Phase 0 establishes the foundational Angular 22 workspace for FluxCommerce.

The goal is to create a stable, testable, and architecturally aligned frontend baseline that can support all subsequent implementation phases without requiring major structural rework.

This phase focuses on:

- Angular workspace initialization
- Multi-application structure
- Shared library boundaries
- Application architecture
- Routing foundation
- Storefront SSR foundation
- Admin CSR foundation
- Environment and application configuration
- Testing infrastructure
- CI test execution
- Architectural verification
- Documentation synchronization

This phase does **not** implement business features.

---

## 2. Architectural References

Implementation must follow:

- `docs/ARCHITECTURE.md`
- `docs/PROJECT_CONTEXT.md`

The architecture defines:

- Angular 22
- Standalone components
- Standalone routing
- Strict TypeScript
- Signals
- Storefront SSR
- Admin CSR
- Feature-based architecture
- Shared libraries
- Explicit dependency boundaries
- Vitest
- Playwright

There is intentionally **no Phase 0.5 API Contract Package**. Backend API contracts are consumed as part of the foundation/integration workflow and are not treated as a separate implementation phase.

---

# 3. Phase Scope

## 3.1 In Scope

- Angular 22 workspace
- Storefront application
- Admin application
- Shared library foundation
- Application and library boundaries
- Standalone architecture
- Routing foundation
- Storefront SSR and hydration foundation
- Admin CSR foundation
- Environment/configuration foundation
- Vitest setup
- Playwright setup
- CI test execution
- Architectural verification
- Foundation cleanup
- Phase completion documentation

## 3.2 Out of Scope

The following must not be implemented as part of Phase 0:

- Authentication implementation
- Login/registration
- Catalog
- Product discovery
- Product details
- Cart
- Checkout
- Payments
- Orders
- Admin business features
- Full localization implementation
- Full theming implementation
- Business-specific shared libraries
- Global application state
- Complex state-management solutions without demonstrated need
- Production deployment infrastructure

---

# 4. Sub-Phases

## 4.1 Sub-Phase 0.1 — Angular Workspace Initialization

### Objective

Create the Angular 22 workspace with the required technical baseline.

### Tasks

- Initialize the Angular 22 workspace.
- Configure TypeScript strict mode.
- Use standalone architecture.
- Establish package management and workspace scripts.
- Configure development and build commands.
- Remove unnecessary generated/demo code.
- Verify the workspace builds successfully.

### Expected Result

A clean, runnable Angular 22 workspace exists and provides the baseline for the remaining sub-phases.

### Acceptance Criteria

- Angular 22 is used.
- TypeScript strict mode is enabled.
- Standalone architecture is enabled.
- The workspace builds successfully.
- No unnecessary demo application code remains.

---

## 4.2 Sub-Phase 0.2 — Multi-Application Workspace

### Objective

Create the two frontend applications inside the same workspace.

### Target Structure

```text
apps/
├── storefront/
└── admin/
```

### Tasks

- Create the Storefront application.
- Create the Admin application.
- Configure independent application entry points.
- Configure independent build targets.
- Establish independent application roots.
- Verify both applications can run independently.

### Architectural Rules

```text
Storefront
→ Customer-facing application
→ SSR-oriented

Admin
→ Internal administration application
→ CSR-oriented
```

### Acceptance Criteria

- Both applications exist in the same workspace.
- Both applications build successfully.
- Both applications can be started independently.
- No business functionality is introduced.

---

## 4.3 Sub-Phase 0.3 — Shared Libraries Foundation

### Objective

Establish the shared library boundaries required by the frontend architecture.

### Target Structure

```text
libs/
├── api/
├── auth/
├── ui/
├── i18n/
├── theming/
├── models/
└── utils/
```

### Tasks

Create the shared library foundation with minimal initial implementation.

Each library should have a clear responsibility:

### `libs/api`

Foundation for:

- API infrastructure
- API configuration
- Common API abstractions

### `libs/auth`

Foundation for:

- Authentication infrastructure
- Session-related abstractions

No authentication workflow is implemented in Phase 0.

### `libs/ui`

Foundation for:

- Business-agnostic reusable UI primitives

Do not implement the complete design system yet.

### `libs/i18n`

Foundation for:

- Localization-related infrastructure

Full localization begins in Phase 4.

### `libs/theming`

Foundation for:

- Theme-related infrastructure

Full theming begins in Phase 3.

### `libs/models`

Contains only genuinely shared types.

### `libs/utils`

Contains only generic utilities.

Do not turn this library into a general-purpose dumping ground.

### Acceptance Criteria

- Required libraries exist.
- Each library has a clearly defined responsibility.
- No business feature code is moved into shared libraries.
- Unnecessary abstractions are avoided.
- Applications can consume shared libraries through explicit public APIs.

---

## 4.4 Sub-Phase 0.4 — Application Architecture & Dependency Boundaries

### Objective

Make the architecture enforceable through project structure and dependency rules.

### Dependency Direction

```text
Applications
    ↓
Features
    ↓
Shared Libraries
```

### Tasks

- Establish application boundaries.
- Establish feature ownership conventions.
- Establish shared-library ownership conventions.
- Define public entry points for shared libraries.
- Prevent direct access to internal library implementation.
- Prevent unrelated feature-to-feature internal dependencies.
- Add dependency-boundary checks where practical.
- Document any tooling-specific architectural rules.

### Forbidden Pattern

```text
Feature A
    ↓
Feature B internal implementation
```

### Preferred Pattern

```text
Feature A
    ↓
Stable contract / shared abstraction / backend API
```

### Acceptance Criteria

- Dependency direction is explicit.
- Shared library public APIs are defined.
- Internal implementation is not exposed unnecessarily.
- No unrelated feature dependencies exist.
- Architectural boundary violations can be detected.

---

## 4.5 Sub-Phase 0.5 — Application Shell & Routing Foundation

### Objective

Create the basic application shells and routing foundations without implementing business features.

### Storefront

Establish:

```text
Storefront
├── core/
├── layout/
├── features/
└── app.routes.ts
```

### Admin

Establish:

```text
Admin
├── core/
├── layout/
├── features/
└── app.routes.ts
```

### Tasks

- Configure standalone routing.
- Configure root application routes.
- Establish lazy-loading conventions.
- Establish application layout boundaries.
- Establish placeholder/root routes where required.
- Establish 404 routing foundation if appropriate.
- Verify route configuration for both applications.

### Acceptance Criteria

- Both applications have standalone routing.
- Routing is independently configured.
- Lazy-loading conventions are established.
- Application shell boundaries are clear.
- No business feature implementation is included.

---

## 4.6 Sub-Phase 0.6 — Storefront SSR Foundation

### Objective

Establish SSR and hydration for the Storefront before implementing SEO-sensitive business pages.

### Tasks

- Configure Angular SSR for Storefront.
- Configure server-side application execution.
- Configure hydration.
- Verify client/server rendering behavior.
- Identify browser-only API boundaries.
- Ensure foundation code is SSR-safe.
- Verify the Storefront can render successfully through SSR.

### Admin

The Admin application remains CSR-oriented and does not require equivalent SSR infrastructure.

### Acceptance Criteria

- Storefront SSR is configured.
- Hydration works correctly.
- Storefront foundation renders without server-side runtime errors.
- Browser-only APIs are not used unsafely during SSR.
- Admin remains CSR-oriented.

---

## 4.7 Sub-Phase 0.7 — Environment & Application Configuration

### Objective

Create a safe and maintainable configuration foundation.

### Tasks

- Establish development configuration.
- Establish production configuration.
- Configure backend API base URL.
- Establish application configuration access.
- Separate environment-specific configuration.
- Ensure frontend configuration contains no secrets.
- Provide a clean abstraction for consuming configuration.

### Architectural Rule

Frontend configuration may contain public configuration values, but must never contain secrets or credentials.

### Acceptance Criteria

- Development and production configurations are separated.
- API configuration is centralized.
- Components do not hard-code API URLs.
- No secrets are exposed through frontend configuration.
- Configuration is accessible through a consistent mechanism.

---

## 4.8 Sub-Phase 0.8 — Testing Foundation

### Objective

Establish automated testing from the beginning of frontend development.

## Vitest

Configure Vitest for:

- Unit tests
- Component tests
- Services
- Utilities
- State logic

### Initial Tests

At minimum, include tests proving that:

- A shared utility can be tested.
- A basic service can be tested.
- A basic component can be tested.
- Storefront foundation works.
- Admin foundation works.

## Playwright

Configure Playwright for:

- End-to-end testing
- Browser execution
- Application base URLs
- Test environment

### Initial E2E Smoke Tests

At minimum:

```text
Storefront loads successfully
Admin loads successfully
```

Business E2E journeys are implemented in later phases.

### Acceptance Criteria

- Vitest runs successfully.
- Component/unit tests execute successfully.
- Playwright is configured.
- E2E smoke tests pass.
- Test commands are documented.

---

## 4.9 Sub-Phase 0.9 — CI Testing Foundation

### Objective

Ensure the frontend baseline can be automatically verified.

### Pipeline

The initial CI verification should follow:

```text
Install
   ↓
Build
   ↓
Unit / Component Tests
   ↓
E2E Smoke Tests
```

### Tasks

- Configure CI execution.
- Run production-oriented build validation.
- Run Vitest.
- Run Playwright smoke tests.
- Ensure test failures fail the pipeline.
- Keep CI configuration minimal and maintainable.

### Out of Scope

Full deployment pipelines and production hosting configuration are not part of Phase 0.

### Acceptance Criteria

- CI can build the workspace.
- Unit/component tests execute in CI.
- E2E smoke tests execute in CI where the environment supports them.
- A failing test causes CI failure.

---

## 4.10 Sub-Phase 0.10 — Architectural Verification

### Objective

Verify that the implemented foundation actually follows the architecture.

### Verification Areas

#### Workspace

- Correct applications exist.
- Correct shared libraries exist.
- No unnecessary projects exist.

#### Architecture

- Standalone architecture is used.
- Feature ownership conventions are established.
- Shared library boundaries are respected.
- Dependency direction is correct.

#### Applications

- Storefront is SSR-enabled.
- Admin is CSR-oriented.
- Applications remain independently runnable.

#### Routing

- Standalone routing is used.
- Lazy-loading conventions are established.

#### Testing

- Vitest is functional.
- Playwright is functional.
- Smoke tests pass.

### Acceptance Criteria

No known architectural violation remains unresolved unless explicitly documented.

---

## 4.11 Sub-Phase 0.11 — Foundation Quality & Cleanup

### Objective

Leave the project in a clean state before Phase 1 begins.

### Tasks

- Remove unused dependencies.
- Remove generated/demo code that is no longer required.
- Review naming conventions.
- Review folder structure.
- Review imports and public APIs.
- Review configuration.
- Review test organization.
- Review SSR implementation.
- Review both application builds.
- Fix technical debt introduced during Phase 0.

### Acceptance Criteria

- No unnecessary dependencies remain.
- No unused demo code remains.
- Both applications build successfully.
- Tests pass.
- Workspace structure matches the architecture.
- No known blocking technical debt remains.

---

## 4.12 Sub-Phase 0.12 — Phase Completion & Documentation

### Objective

Formally close Phase 0 and synchronize project documentation.

### Tasks

- Execute the complete Phase 0 verification checklist.
- Verify all acceptance criteria.
- Record test results.
- Record architectural verification results.
- Document important implementation decisions.
- Create the Phase 0 completion report.
- Update `PROJECT_CONTEXT.md`.
- Update `ARCHITECTURE.md` only if actual implementation introduced justified architectural changes.

### Acceptance Criteria

Phase 0 is considered complete only when:

- All sub-phase acceptance criteria are satisfied.
- Both applications build successfully.
- Storefront SSR works.
- Admin CSR works.
- Shared libraries exist with correct boundaries.
- Architecture verification passes.
- Unit/component tests pass.
- E2E smoke tests pass.
- CI verification passes.
- Documentation is synchronized.

---

# 5. Phase 0 Dependency Order

The implementation order should remain:

```text
0.1 Workspace Initialization
        ↓
0.2 Multi-Application Workspace
        ↓
0.3 Shared Libraries Foundation
        ↓
0.4 Architecture & Dependency Boundaries
        ↓
0.5 Application Shell & Routing
        ↓
0.6 Storefront SSR Foundation
        ↓
0.7 Environment & Configuration
        ↓
0.8 Testing Foundation
        ↓
0.9 CI Testing Foundation
        ↓
0.10 Architectural Verification
        ↓
0.11 Quality & Cleanup
        ↓
0.12 Completion & Documentation
```

Some implementation work may be performed in parallel where dependencies allow it, but the architectural baseline must be established before business features are introduced.

---

# 6. Phase 0 Definition of Done

Phase 0 is complete when the following baseline exists:

```text
FluxCommerce Angular Workspace
│
├── apps/
│   ├── storefront/
│   │   ├── Standalone
│   │   ├── Routing
│   │   └── SSR + Hydration
│   │
│   └── admin/
│       ├── Standalone
│       └── CSR
│
├── libs/
│   ├── api/
│   ├── auth/
│   ├── ui/
│   ├── i18n/
│   ├── theming/
│   ├── models/
│   └── utils/
│
├── Architecture Boundaries
│
├── Environment / Configuration
│
├── Vitest
│
├── Playwright
│
└── CI Verification
```

### Required Verification

```text
Angular 22
    ✓

Strict TypeScript
    ✓

Standalone Architecture
    ✓

Storefront
    ✓ SSR
    ✓ Hydration
    ✓ Routing

Admin
    ✓ CSR
    ✓ Routing

Shared Libraries
    ✓ Boundaries
    ✓ Public APIs

Testing
    ✓ Vitest
    ✓ Playwright

CI
    ✓ Build
    ✓ Unit / Component Tests
    ✓ E2E Smoke Tests

Architecture
    ✓ Dependency Boundaries
    ✓ No Unnecessary Cross-Feature Coupling
```

---

# 7. Phase 0 Exit Condition

The project must be ready to begin:

```text
Phase 1 — Core Infrastructure
```

At the end of Phase 0, the project should provide a stable Angular foundation, but it should still contain no implemented commerce workflows.

The next phase can therefore focus on frontend ↔ backend communication infrastructure, API clients, interceptors, error normalization, cancellation, pagination, and shared resource-state patterns without needing to revisit the workspace architecture.
