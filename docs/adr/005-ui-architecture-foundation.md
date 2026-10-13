# ADR 005 — UI Architecture Foundation (Phase 3, Sub-Phase 3.1)

Status: Accepted (2026-09-09, Phase 3 Sub-Phase 3.1).

## Context

Phase 3 establishes the shared UI foundation for the Storefront and Admin
applications (see `docs/phases/PHASE_3_UI_SYSTEM_THEMING&RTL_FOUNDATION.md`).
Before any tokens, theme logic, components, or shells are built, the
workspace needs explicit boundaries between presentation infrastructure
(`libs/ui`, `libs/theming`) and application composition layers
(`apps/storefront`, `apps/admin`), plus enforceable naming, export, and
dependency-direction conventions.

## Decision

### Responsibilities

```text
libs/ui      → business-agnostic presentation primitives only
                (HOW something looks: markup + styling + local UI state).
                Features decide WHAT/WHEN and own all copy, data access,
                and business state. Pre-existing Phase 1 async-state
                primitives (LoadingIndicator, Skeleton, EmptyState,
                RetryButton, ErrorState) plus the shared ComponentSize
                alias are the only current occupants.

libs/theming → visual infrastructure only (design tokens, CSS variables,
                theme definitions, switching, persistence — built in
                Sub-Phases 3.2/3.3). Current content is identifiers only:
                Theme, DEFAULT_THEME, THEME_ATTRIBUTE.
                Components consume CSS variables/tokens; they never depend
                on the theme service directly.

apps/storefront → customer-facing composition layer (routes, pages,
                    features, storefront shell from 3.6). Composes
                    libs/ui + libs/theming; owns all commerce UI.

apps/admin      → internal-dashboard composition layer (routes, pages,
                    features, admin shell from 3.7). Composes libs/ui +
                    libs/theming; owns all administration UI.
```

### Ownership rule

Generic, reusable, business-free presentation belongs in `libs/ui`.
Anything carrying business meaning stays feature-owned:

```text
libs/ui                          apps/<app>/features/<feature>
Card                         vs  ProductCard
Table                        vs  OrderTable
Dialog                       vs  CheckoutDialog
```

A business-specific component is never moved into `libs/ui` merely
because it might one day be reused.

### Naming and export conventions

- Shared UI selectors carry the `flux-` prefix
  (`flux-loading-indicator`, `flux-empty-state`, …).
- Library files are kebab-case TypeScript (`loading-indicator.ts`);
  component classes are PascalCase (`LoadingIndicator`); shared
  size/type aliases are PascalCase (`ComponentSize`).
- Libraries are consumed only through their `@flux/*` barrel
  (`libs/<lib>/src/public-api.ts`); relative traversal into `libs/` and
  deep `@flux/<lib>/…` imports are forbidden (existing lint + audit).
- Every `libs/*/src/public-api.ts` re-exports its public modules via
  `export *`.
- Components use `OnPush` change detection, `@Input()` decorators for
  inputs (the raw Vitest runner lacks the signal-input transform), pure
  markup + CSS (SSR/hydration safe), and CSS logical properties
  (RTL-safe from the start).

### Dependency directions

```text
apps/storefront ─┐
                 ├─→ libs/ui (presentation, zero @flux/* deps)
apps/admin ──────┤
                 └─→ libs/theming (visual infra, zero @flux/* deps)
```

- `apps` depend on `libs/ui` and `libs/theming`; the reverse is
  forbidden (`noAppFromLibs` lint rule + architecture audit).
- `libs/ui` imports no `@flux/*` barrel at all — in particular never
  `@flux/theming` (theme details stay out of components).
- `libs/theming` imports no `@flux/*` barrel at all — in particular
  never `@flux/ui`.
- Neither library imports business-feature/domain specifiers (catalog,
  cart, checkout, orders, inventory, payments, auth business logic),
  application code, or `HttpClient` (only `libs/api` owns transport).
- `storefront` and `admin` never import each other.

### Enforcement

- `eslint.config.mjs`: per-scope `libs/ui/**` and `libs/theming/**`
  `no-restricted-imports` blocks (`noFluxInUi`, `noFluxInTheming`,
  `noBusinessInPresentation`, `noHttpInPresentation` on top of the
  workspace-wide barrel/traversal/app-direction rules).
- `scripts/verify-architecture.mjs` §3.1 checks: no `@flux/*` imports in
  either library, no business/domain specifiers, no `HttpClient`,
  `flux-` selector prefix on all shared UI components, plus scope-stop
  guards (no `ThemeService`, no token CSS, no core primitives yet).

## Consequences

- Future sub-phases (3.2 tokens, 3.3 theme system, 3.4 primitives, 3.5
  layout, 3.6/3.7 shells) have a fixed, lint-enforced surface to build
  on; violations fail `npm run lint` and `npm run verify:architecture`.
- `libs/ui` and `libs/theming` cannot silently couple to business
  features or to each other.
- Scope is explicitly stopped at 3.1: no tokens, theme logic, core
  primitives, or shell/navigation work is part of this change.

## Scope confirmation

This ADR implements Sub-Phase 3.1 only. Sub-Phases 3.2+ are not started.
