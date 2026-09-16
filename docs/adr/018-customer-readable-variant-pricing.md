# ADR 018 — Customer-Readable Variant Pricing

Status: Accepted (2026-09-16, priced-variant contract change).

## Context

ADR 016/017 parked two storefront capabilities behind a precise contract
gap: no customer-readable endpoint exposed variant pricing, while the
cart add-item wire bodies (`AddCartItemRequest`) require a
`unitPriceAmount` + `currency` snapshot. The details page therefore
rendered SKU-only commercial content and left the fully built Add to
Cart button unmounted (pinned by unit and E2E tests), with the exact
unblock criterion recorded: the backend exposes variant pricing in a
customer-readable contract.

The backend contract has now changed exactly that way
(`docs/frontend-contract/API_CONTRACT.md` §2.3,
`docs/frontend-contract/DTO_REFERENCE.md` §2):

- `VariantResponse` gains `decimal UnitPriceAmount` + `string Currency`
  (anonymous variant reads).
- `CatalogVariantSummary` gains the same pair (details variant lists).

## Decision

Lift the parking; change nothing about the honesty rules:

- Mirrors first: `@flux/models` (`VariantResponse`,
  `CatalogVariantSummary`) gain the fields — the single declaration
  site, so no contract drift is possible. Every fixture becomes
  contract-exact.
- Display: the commercial section renders the backend-issued snapshot
  (SKU + unit price, formatted per culture, display only — never an
  input to math). No totals are computed locally; availability still
  renders nowhere (inventory reads stay `Admin`-only).
- Submission: the page projects the snapshot through the existing
  validated `toAddToCartPricing` helper (single site — display and wire
  body can never disagree) and submits guest lines through the existing
  machine + `addGuestCartItem` façade. Guest `cartId` lifecycle is NOT
  duplicated: the product-details route borrows the cart feature's
  `CartState`/`GuestCartService` seam (one-way, no cycle), and a dead
  identity heals for the next attempt via the 7.5 recovery.
- Authenticated submission stays parked: the page never inspects auth
  state (Phase 7.6 owns auth branching). Guest submission is the only
  path; login-time merge (7.7) reconciles guest carts afterwards.

## Consequences

- The details journey completes end to end for guests
  (select → price → quantity → add → confirmation), pinned by unit,
  integration, and E2E tests asserting the exact wire body.
- ADR 016/017 remain historical records of the parked state; this ADR
  records the unblock. `ARCHITECTURE.md` §21 is updated to match the
  code — the parked/unmounted/refused passages described the
  pre-pricing contract.
