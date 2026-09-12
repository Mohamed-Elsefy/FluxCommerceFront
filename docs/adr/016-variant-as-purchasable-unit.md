# ADR 016 — Variant as Purchasable Unit

Status: Accepted (2026-09-12, Phase 6 Sub-Phases 6.4–6.5).

## Context

Phase 6 required variant selection with SKU/price/availability bound to
the selection, and its examples suggested Color/Size/Style dimensions.
The backend contract, however, models variants as a flat
`VariantResponse` list (`id`/`sku`/`name`/`status` plus deletion flags)
with no option dimensions — and no price, currency, or stock fields on
any customer-readable endpoint (`VariantResponse` is annotated "no
price" in three contract sources; inventory reads are `Admin`-only;
checkout reprices authoritatively server-side).

## Decision

Follow the contract, not the examples:

- The selector offers backend names only; selectability follows `status`
  + deletion flags through the single pure guard `isSelectableVariant`,
  enforced at three layers (native `disabled`, component emit-guard,
  state resolver) so invalid selections are impossible by construction.
- No default selection: the contract defines none, so selection starts
  empty and stays empty until the customer chooses.
- The selected variant object (`selectedVariant`, derived) is the single
  source of truth for variant-specific data; SKU renders live off it, so
  switches cannot leave stale information by construction.
- Price and availability render nowhere. Displaying either would require
  inventing backend data, violating the §6.5 rules ("must come from the
  backend contract") and `ARCHITECTURE.md` §21 — so the commercial
  section is SKU-only, with tests pinning the single-row surface, and
  the omission is documented in code, not hidden.

## Consequences

- The storefront cannot show prices or stock until the backend exposes
  variant pricing in a customer-readable contract — the precise unblock
  criterion, recorded here instead of papered over with fabricated data.
- Sub-Phase 6.7 inherits the same constraint: wire bodies require a
  price snapshot with no storefront source (see ADR 017).
