# ADR 015 — Product Details State Isolation

Status: Accepted (2026-09-12, Phase 6 Sub-Phases 6.1–6.9).

## Context

The Product Details feature needed substantially more state than Catalog:
four resource slots (product, specifications, images, variants), a
validated variant selection, an orderability guard, a purchase quantity,
and an add-to-cart submission machine. The temptation was a shared or
global store — especially for selection/quantity, which Phase 7 (cart)
will eventually consume alongside its own state.

The architecture (`ARCHITECTURE.md` §9) demands the smallest appropriate
scope, and Phase 6 explicitly forbade global Catalog/Product state,
NgRx, SignalStore, and premature cart state.

## Decision

One route-provided `ProductDetailsState`, same structural enforcement as
ADR 012, extended to UI-adjacent state:

- `@Injectable()` with **no** `providedIn`, provided once on the parent
  `productDetailsRoutes` entry. Unit tests pin `providedIn !== 'root'`
  and per-site independence.
- Resource slots reuse the Phase 1 `createResourceState` primitive; the
  selection is a plain signal validated through the pure
  `resolveVariantSelection` helper (unknown/inactive/deleted ids are
  unrepresentable); quantity is a plain signal guarded by
  `isValidQuantity`; the submission lifecycle reuses
  `createResourceState<CartResponse>` projected through
  `toAddToCartStatus`, so failures normalize through existing
  infrastructure instead of new machinery.
- Derived state (`selectedVariant`, `selectedVariantSelectable`) is
  `computed` — never set directly, so it can never disagree with its
  sources (including the self-healing case where a refetch drops the
  selected id).
- SSR hydration from Sub-Phase 6.9 reuses the Phase 5.10 pattern
  (ADR 014): per-id transfer keys, consume-once on the browser,
  server-only stores, failures never stored.
- The gallery's selected image stays component-local (`ARCHITECTURE.md`
  §9 lists it explicitly); the feature state holds the image resource
  only.

## Consequences

- Product Details state cannot leak globally or into Phase 7 by
  construction; Phase 7 reads the documented selectors
  (`selectedVariant`, `quantity`, `addToCartStatus`) through its own
  lifecycle instead of inheriting stores.
- No cart contents are retained anywhere in the feature: the
  `CartResponse` envelope unwraps for status mapping only — items,
  totals, and cart ids are never read out of it (grep-verified).
