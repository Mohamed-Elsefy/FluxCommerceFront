# ADR 037 — Frontend Refactoring Pass (Phases A–E)

Status: Accepted.

## Context

After Supplements S1–S3 the frontend was complete and green but had
accumulated structural debt across 15 phases of vertical-slice
delivery: duplicated logic behind per-feature mirrors, one real
feature-to-feature state leak (`product-details`/`checkout` importing
`cart/state` internals), duplicated presentational components, dead
scaffolding, and mixed-context housing. A full-codebase review
(`docs/PROJECT_CONTEXT.md`, `ARCHITECTURE.md`, `DESIGN.md`,
`frontend-contract/`, completion reports) plus targeted codebase audits
confirmed the boundaries were otherwise healthy (audit 106/106, no
cycles, no cross-app imports).

## Decision

A five-phase refactoring pass with a no-behavior-change rule (no wire,
no contract, no UX change — moves, extractions, and delegations only):

### Phase A — Shared foundation in `libs/` (libs first)

- `libs/models` gains canonical pure modules: `money.ts` (`Money` +
  currency helpers), `failure.ts` (`NormalizedFailure` + status-first
  classifiers), `cart-identity.ts` (`CartSnapshot` + projectors),
  `image.ts` (`ImageCandidate`), `quantity.ts` (floor + validity +
  parser), each with colocated specs and barrel exports.
- `SocialImageCandidate` (`@flux/utils`) becomes an alias of the
  canonical `ImageCandidate` (type-only edge `utils → models`, no
  runtime cycle).
- `libs/api` gains the missing symmetric `previousPageQuery`
  (+ specs). The spec-only `@flux/ui`/`@flux/i18n` imports in
  `libs/api` integration specs are documented as intentional
  (spec-only, excluded from cycle detection).

### Phase B — Duplicate unification (extract shared)

- Admin: four status badges (`order`, two `payment`, `user`) → generic
  `StatusBadge<TStatus>` in `apps/admin/shared/` (status + map +
  unknown-key + translator inputs) with four thin adapters keeping
  selectors, classes, and behavior (all pre-existing specs pass
  unchanged).
- Storefront: byte-identical `OrdersPagination` +
  `PaymentsMinePagination` → `StorefrontPagination` in the new
  `apps/storefront/shared/`; two SF status badges → generic
  `StorefrontStatusBadge` in the same shared dir. The catalog pager
  stays (different visuals), as do `field-errors` ×2 (different
  contracts), quantity steppers (different markup/a11y), and order
  summaries (different purchase-phase semantics) — each recorded as
  evaluated-keep.

### Phase C — Cart isolation (the R1 leak)

- New public seam `features/cart/cart-capabilities.ts` (token
  `CART_CAPABILITIES` + `CartCapabilities` interface + moved pure
  dead-identity classifier) and `cart-capabilities.service.ts` (sole
  implementation + `provideCartCapabilities()`).
- `checkout` and `product-details` routes/pages/specs depend only on
  the seam; zero `cart/state|models` imports remain outside `cart/`
  (one transport stub in a spec is the documented exception).
- `verify-architecture.mjs` gains a permanent Phase C rule
  (107/107): any future reach into `cart/` outside the two seam files
  fails the audit.

### Phase D — Structural organization

- Deleted both empty `app/core/` scaffolds; moved the dev-only
  `design-preview` page from `features/` to `app/dev/` (route path
  unchanged).
- Documented (not split) the `orders`+`account` co-location
  (bidirectional intra-feature use — splitting would manufacture
  cross-feature coupling) and the single-page dashboard exception
  (no `dashboard.routes.ts` wrapper without children).
- Naming variants (`*-boundaries` vs `*-structure`, flat auth
  validators, models-side formatters) evaluated and kept — each
  locally justified; renaming ~15 files for cosmetic uniformity was
  rejected per the simplicity rule.

### Phase E — Focused splits and canonical adoption

- `payment-lifecycle.ts` extracted from `payment-state.ts` (pure
  transition table + guard + contexts; class + specs import from the
  new module, 58 specs green unchanged).
- Feature failure mirrors (`CheckoutFailure`, `OrdersFailure`) become
  aliases of `NormalizedFailure` with predicates delegating to the
  shared classifiers (domain-specific classifiers kept);
  cart/product-details quantity helpers become aliases/re-exports of
  the shared quantity module (single implementation).
- Cohesive signal classes (`CartState`), orchestration pages, and pure
  models were deliberately NOT split — size alone (inflated by
  intentional docblocks) is not a demonstrated problem.

## Consequences

- No behavior, wire, contract, or UX change in any phase (verified by
  unchanged pre-existing specs plus new specs for every new module).
- Full matrix per phase: `tsc` (apps + spec + libs), `eslint`,
  `prettier`, `verify-architecture` 107/107, targeted unit suites,
  both production builds green.
- Known pre-existing issues (not introduced, left untouched):
  `checkout-page.css` prettier drift (fails on clean HEAD) and the
  storefront E2E suites failing identically on clean HEAD
  (environmental — backend-dependent; proven by stash-baseline run).
- Latent suite-order hazard (found, not fixed — out of scope):
  `ng test` runs with worker `isolate: false`, so all spec files share
  one jsdom `localStorage`, which backs `CultureService`. A full-suite
  run intermittently fails 4 `payment-result-page` assertions with
  French copy (a file-order-dependent culture leak); identical trees
  pass on re-run (1494/1494 twice, including once without these
  changes), and the file passes 15/15 in isolation and in combination
  runs. The durable fix (guaranteed culture reset per spec file)
  belongs to a testing-hardening pass, not to this refactoring.
