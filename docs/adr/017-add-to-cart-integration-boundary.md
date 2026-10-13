# ADR 017 — Add-to-Cart Integration Boundary

Status: Accepted (2026-09-12, Phase 6 Sub-Phase 6.7).

## Context

Phase 6 had to connect Product Details to the Cart capability without
implementing the Cart experience (Phase 7), while the wire bodies
(`AddCartItemRequest`) require `unitPriceAmount` + `currency` for which
— per ADR 016 — no customer-readable contract source exists, and guest
submission additionally needs `cartId` lifecycle explicitly deferred to
Phase 7.

## Decision

Define the boundary completely, mount only what can honestly run:

- Payload: `AddToCartItem` (`variantId` + `quantity`, validated, `null`
  when unsubmittable) is the phase's "selected purchasable item and
  quantity"; pricing travels as an explicit, validated caller argument
  (`AddToCartPricing`) — never defaulted, estimated, or fabricated.
- Transport: thin `addGuestCartItem` / `addAuthenticatedCartItem`
  façades over the real endpoints/bodies, delegating errors untouched
  (Phase 7 reuses them instead of rebuilding).
- Machine: `idle → adding → added | error` on a `ResourceStateStore`
  with an in-flight duplicate lock and guard short-circuits, reusing
  Phase 1 normalization; lifecycle resets on product/variant/quantity
  change so stale feedback cannot survive its cause.
- Button: fully implemented four-state control (progress, confirmation,
  error + retry) with doubled submission guards — but deliberately
  UNMOUNTED: mounting a control that can never succeed would mislead
  customers. The page already runs the machine's lifecycle, so mounting
  is a template-only change beside the quantity section (snippet on the
  component), and an E2E boundary-pin test fails loudly if the control
  appears without its price source.
- No cart state anywhere: no pages, lists, totals, updates, removals,
  persistence, or merge (grep-verified; the `CartResponse` envelope is
  status-mapped only).

## Consequences

- Production submission stays parked until a contract price source (or
  Phase 7 price sourcing) provides the snapshot; the trigger is a
  documented one-line call, not a redesign.
- The E2E journey ends at quantity selection by necessity, not by
  omission — reported as the phase's single blocking finding with
  precise unblock criteria.
