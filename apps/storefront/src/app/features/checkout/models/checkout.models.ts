/**
 * Storefront Checkout feature models for Sub-Phase 8.1 — Checkout
 * Architecture & Contract.
 *
 * Scope: `docs/phases/PHASE_8_CHECKOUT.md` §8.1 (contracts and boundaries
 * only — no API integration, no state implementation, no forms, no UI).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §4 and
 * `docs/frontend-contract/DTO_REFERENCE.md` §4
 * (`FluxCommerce.Modules.Orders.Contracts`: `CheckoutRequest`,
 * `CheckoutAddressRequest`, `CheckoutResponse`, `OrderDetailsResponse`) plus
 * `docs/frontend-contract/ERROR_CATALOG.md` §4 (order error codes, status
 * mapping, retry policy). The cart input shape comes from
 * `docs/frontend-contract/DTO_REFERENCE.md` §3 (`CartResponse` /
 * `CartItemResponse`); the cart feature itself is consumed read-only (see
 * `../state/checkout-state-boundaries`).
 *
 * Backend-authoritative data rule (this sub-phase's core constraint): this
 * module performs NO pricing, discount, tax, shipping-cost, or order-total
 * computation — no `unitPrice * quantity`, no subtotal/total summation, no
 * float-math money helpers. Money slots on the order summary stay `null`
 * until the backend provides them (`CheckoutResponse` carries no money at
 * all; totals arrive only via `OrderDetailsResponse` after the order
 * exists). The summary projects backend-issued cart lines for display and
 * reads backend-issued money — it never derives money.
 *
 * Contract-honest omissions (requested by §8.1 example text but absent from
 * the backend contract — never fabricated, test-pinned):
 * - Customer information: the contract carries no customer fields beyond
 *   the address `recipientName` (no email/phone). `CheckoutCustomerInfo`
 *   is a projection of that single field, not a new wire shape.
 * - Shipping method/option: `CheckoutRequest` carries `cartId` plus the two
 *   addresses only. There is no shipping-method field, so nothing is sent;
 *   `CHECKOUT_SHIPPING_METHOD_SUPPORTED` documents the gap (`false`).
 *
 * Ownership (`ARCHITECTURE.md` §5 — feature-based architecture):
 * - Contract mirrors live in `@flux/models` and stay the single
 *   declaration site — `CreateOrderRequest`/`CreateOrderResponse` and the
 *   address types are aliases, never re-declared, so no contract drift is
 *   possible.
 * - This module owns the storefront-readable view types (customer info,
 *   order summary), the `Idempotency-Key` header bounds (shape only — no
 *   generation), pure structural helpers (emptiness, guards, currency
 *   reads), the pure `CheckoutRequest` mapper (form data → wire body), and
 *   the pure checkout error-code unions/classifiers (status-based, never
 *   message-text-based, per `ERROR_CATALOG.md` §0).
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 8.2 — no API client/service, no `HttpClient`, no envelope mapping, no
 *   `Idempotency-Key` generation, no routes.
 * - 8.3 — no SignalStore/signals state implementation (shapes only, see
 *   `../state/checkout-state-boundaries`).
 * - 8.4 — no Reactive Forms, no form groups, no validators, no pages, no
 *   components.
 * - Phase 9 — no payment, Stripe, or client-secret logic.
 */

import type {
  CartItemResponse,
  CartResponse,
  CheckoutAddressRequest,
  CheckoutRequest,
  CheckoutResponse,
  OrderMoneyResponse,
} from '@flux/models';
import {
  hasFieldErrors,
  isAccessDeniedFailure,
  isAuthFailure,
  isConflictFailure,
  isFormPreservingFailure,
  isNotFoundFailure,
  isValidationFailure,
  type NormalizedFailure,
} from '@flux/models';

/**
 * Create Order request (`POST /orders/checkout` body). Re-exported — not
 * re-declared — so the backend shape stays canonical. Travels with the
 * `Idempotency-Key` header (see `IDEMPOTENCY_KEY_*` below), never in the
 * body.
 */
export type CreateOrderRequest = CheckoutRequest;

/**
 * Create Order response (`POST /orders/checkout` payload). Re-exported,
 * not re-declared. Carries NO money — poll `GET /orders/{id}` for the
 * terminal status (`Pending` → `Confirmed | Cancelled`, saga-owned).
 */
export type CreateOrderResponse = CheckoutResponse;

/**
 * Shipping/billing address (`CheckoutAddressRequest`: `line2` optional,
 * everything else required). Re-exported, not re-declared.
 */
export type CheckoutAddress = CheckoutAddressRequest;

/**
 * Customer information carried by the checkout contract. The backend
 * defines no standalone customer object for checkout — the only
 * customer-identifying field is the address `recipientName` — so this is
 * a read-only projection of that field, never a new wire shape. Pure
 * view type for the §8.4 customer section.
 */
export interface CheckoutCustomerInfo {
  readonly recipientName: string;
}

/**
 * Projects the customer info out of a checkout address. Pure — throws
 * nothing, performs no HTTP, computes no prices.
 */
export function toCheckoutCustomerInfo(address: CheckoutAddress): CheckoutCustomerInfo {
  return { recipientName: address.recipientName };
}

/**
 * Shipping method/option selection supported by the backend checkout
 * contract: none. `CheckoutRequest` carries `cartId` plus the two
 * addresses only — there is no shipping-method field to select or send.
 * This constant pins the gap so §8.4 never invents a method control that
 * the backend would ignore. Shipping cost remains backend-authoritative
 * (`OrderDetailsResponse.shippingCost`, read-only).
 */
export const CHECKOUT_SHIPPING_METHOD_SUPPORTED = false as const;

/**
 * Shipping selection model for the contract as written: no selectable
 * method exists, so the selection is empty. Kept as a named type (rather
 * than inlining `Record<never, never>`) so a future backend shipping
 * option has one declaration site to extend.
 */
export type CheckoutShippingSelection = Record<never, never>;

/**
 * The empty (and only) shipping selection. Pure — throws nothing.
 */
export function emptyShippingSelection(): CheckoutShippingSelection {
  return {};
}

/**
 * Whether the backend checkout contract supports choosing a shipping
 * method. Always `false` in the current contract — callers must not
 * render or submit a method choice. Pure — throws nothing.
 */
export function isShippingMethodSupported(): false {
  return CHECKOUT_SHIPPING_METHOD_SUPPORTED;
}

/** `CheckoutAddressRequest.recipientName`: `[Required][StringLength(100)]`. */
export const CHECKOUT_RECIPIENT_NAME_MAX_LENGTH = 100;

/** `CheckoutAddressRequest.line1`/`line2`: `[StringLength(200)]`. */
export const CHECKOUT_ADDRESS_LINE_MAX_LENGTH = 200;

/** `CheckoutAddressRequest.city`/`region`: `[Required][StringLength(100)]`. */
export const CHECKOUT_CITY_MAX_LENGTH = 100;

/** See above — `region` shares the 100-char bound. */
export const CHECKOUT_REGION_MAX_LENGTH = 100;

/** `CheckoutAddressRequest.postalCode`: `[Required][StringLength(20)]`. */
export const CHECKOUT_POSTAL_CODE_MAX_LENGTH = 20;

/**
 * `CheckoutAddressRequest.countryCode`: `[Required][StringLength(2, Min 2)]`
 * — exactly 2 UPPER ISO-3166 characters.
 */
export const CHECKOUT_COUNTRY_CODE_LENGTH = 2;

/** `Idempotency-Key` header: required, trimmed, 1..128 chars (not in body). */
export const IDEMPOTENCY_KEY_MIN_LENGTH = 1;

/** See above — the 128-char upper bound. */
export const IDEMPOTENCY_KEY_MAX_LENGTH = 128;

/**
 * Whether `value` is a submittable idempotency key: trimmed length within
 * `1..128`. Structural pre-check only — key generation lives in §8.2.
 * Pure — throws nothing.
 */
export function isValidIdempotencyKey(value: string | null | undefined): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const length = value.trim().length;
  return length >= IDEMPOTENCY_KEY_MIN_LENGTH && length <= IDEMPOTENCY_KEY_MAX_LENGTH;
}

/**
 * Whether `value` is exactly 2 uppercase ASCII letters (the wire shape of
 * `countryCode`). Structural pre-check only — backend validation stays
 * authoritative. Pure — throws nothing.
 */
export function isValidCountryCode(value: string | null | undefined): boolean {
  return (
    typeof value === 'string' &&
    value.length === CHECKOUT_COUNTRY_CODE_LENGTH &&
    /^[A-Z]{2}$/.test(value)
  );
}

function isNonBlankWithin(value: unknown, maxLength: number): boolean {
  return typeof value === 'string' && value.trim() !== '' && value.length <= maxLength;
}

/**
 * Structural pre-check for a checkout address against the contract's
 * `DataAnnotations` bounds (required non-blank fields, length caps,
 * `countryCode` exactly 2 uppercase). Never a substitute for backend
 * validation (`Order.InvalidAddress` stays authoritative) — it only keeps
 * unusable input from reaching submission. Pure — throws nothing.
 */
export function isValidCheckoutAddress(address: CheckoutAddress | null | undefined): boolean {
  if (!address) {
    return false;
  }
  return (
    isNonBlankWithin(address.recipientName, CHECKOUT_RECIPIENT_NAME_MAX_LENGTH) &&
    isNonBlankWithin(address.line1, CHECKOUT_ADDRESS_LINE_MAX_LENGTH) &&
    (address.line2 === null ||
      address.line2 === undefined ||
      (typeof address.line2 === 'string' &&
        address.line2.length <= CHECKOUT_ADDRESS_LINE_MAX_LENGTH)) &&
    isNonBlankWithin(address.city, CHECKOUT_CITY_MAX_LENGTH) &&
    isNonBlankWithin(address.region, CHECKOUT_REGION_MAX_LENGTH) &&
    isNonBlankWithin(address.postalCode, CHECKOUT_POSTAL_CODE_MAX_LENGTH) &&
    isValidCountryCode(address.countryCode)
  );
}

/**
 * Form-side address input for §8.4 (plain data — no `FormGroup` here).
 * `line2` accepts `''` from text inputs; the mapper normalizes it to
 * `null` for the wire.
 */
export interface CheckoutAddressInput {
  readonly recipientName: string;
  readonly line1: string;
  readonly line2?: string | null;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
  readonly countryCode: string;
}

/**
 * Maps form-side address input to the wire `CheckoutAddressRequest`.
 * Normalizes blank `line2` to `null` (the contract's absent-value shape);
 * every other field passes through verbatim — no trimming, no casing, no
 * business rules. Pure — throws nothing, performs no HTTP.
 */
export function toCheckoutAddress(input: CheckoutAddressInput): CheckoutAddress {
  const line2 = input.line2 ?? null;
  return {
    recipientName: input.recipientName,
    line1: input.line1,
    line2: typeof line2 === 'string' && line2.trim() === '' ? null : line2,
    city: input.city,
    region: input.region,
    postalCode: input.postalCode,
    countryCode: input.countryCode,
  };
}

/**
 * Builds the `POST /orders/checkout` body from a cart id plus the two
 * form-side addresses. The `cartId` names the backend cart being ordered
 * (ownership is enforced server-side: foreign carts → `403
 * CartAccessDenied`, unknown carts → `404 CartNotFound`). Pure — throws
 * nothing, performs no HTTP, computes no prices.
 */
export function buildCreateOrderRequest(
  cartId: string,
  shippingAddress: CheckoutAddressInput,
  billingAddress: CheckoutAddressInput,
): CreateOrderRequest {
  return {
    cartId,
    shippingAddress: toCheckoutAddress(shippingAddress),
    billingAddress: toCheckoutAddress(billingAddress),
  };
}

/**
 * One order-summary line projected from a backend-issued cart line for
 * display. Carries NO `lineTotal` — the cart contract exposes none and
 * the frontend must not derive one. Read-only; prices echo verbatim.
 */
export interface CheckoutSummaryLine {
  readonly productName: string;
  readonly sku: string;
  readonly quantity: number;
  readonly unitPriceAmount: number;
  readonly currency: string;
}

/**
 * Projects a display line out of a backend-issued cart line. Pure —
 * throws nothing, performs no HTTP, computes no prices.
 */
export function toCheckoutSummaryLine(item: CartItemResponse): CheckoutSummaryLine {
  return {
    productName: item.productName,
    sku: item.sku,
    quantity: item.quantity,
    unitPriceAmount: item.unitPriceAmount,
    currency: item.currency,
  };
}

/**
 * Checkout order summary view model (the §8.5 read model, declared here
 * so its backend-authoritative rule is pinned at the contract layer).
 *
 * - `lines` / counts / `currency` project the backend-issued cart lines
 *   (display only — never inputs to math).
 * - `subtotal` / `shippingCost` / `discount` / `grandTotal` are
 *   backend-authoritative money slots. `POST /orders/checkout` returns no
 *   money, so every slot stays `null` until an `OrderDetailsResponse`
 *   provides it (mapped in later sub-phases, never derived here). There
 *   is deliberately NO helper in this module that fills them from
 *   `unitPriceAmount * quantity`.
 */
export interface CheckoutOrderSummary {
  readonly cartId: string;
  readonly lines: readonly CheckoutSummaryLine[];
  readonly itemCount: number;
  readonly distinctItemCount: number;
  readonly currency: string | null;
  readonly subtotal: OrderMoneyResponse | null;
  readonly shippingCost: OrderMoneyResponse | null;
  readonly discount: OrderMoneyResponse | null;
  readonly grandTotal: OrderMoneyResponse | null;
}

/**
 * Projects the checkout order summary from a settled cart. Returns `null`
 * for a missing cart (nothing loaded is nothing to summarize). Counts are
 * structural (quantities and line presence, never prices); money slots
 * are always `null` here — backend totals arrive only via
 * `OrderDetailsResponse`. Pure — throws nothing, performs no HTTP.
 */
export function toCheckoutOrderSummary(
  cart: CartResponse | null | undefined,
): CheckoutOrderSummary | null {
  if (!cart) {
    return null;
  }
  const currencies = new Set(cart.items.map((item) => item.currency));
  return {
    cartId: cart.cartId,
    lines: cart.items.map(toCheckoutSummaryLine),
    itemCount: cart.items.reduce((count, item) => {
      const quantity = Number.isInteger(item.quantity) ? item.quantity : 0;
      return count + Math.max(0, quantity);
    }, 0),
    distinctItemCount: cart.items.length,
    currency: currencies.size === 1 ? [...currencies][0] : null,
    subtotal: null,
    shippingCost: null,
    discount: null,
    grandTotal: null,
  };
}

/**
 * Whether backend-issued money is present on a summary (any of the four
 * totals slots filled). Always `false` for freshly projected summaries —
 * the guard exists so consumers never mistake absent totals for zero
 * totals. Pure.
 */
export function hasBackendOrderTotals(summary: CheckoutOrderSummary | null | undefined): boolean {
  return (
    summary?.subtotal !== null &&
    summary?.subtotal !== undefined &&
    summary?.grandTotal !== null &&
    summary?.grandTotal !== undefined
  );
}

/**
 * Whether a summary holds no lines. `null`/`undefined` summaries count as
 * empty (nothing loaded is nothing to review). Pure — throws nothing.
 */
export function isCheckoutSummaryEmpty(summary: CheckoutOrderSummary | null | undefined): boolean {
  return !summary || summary.lines.length === 0;
}

/**
 * `400` checkout failures (`ERROR_CATALOG.md` §4): bad idempotency key,
 * empty cart, bad address, bad list params. Envelope: 7-prop
 * `ValidationProblemDetail` with `errors{field:[msg]}` — the UI renders
 * `detail` + the field map, never the raw code.
 */
export type CheckoutValidationErrorCode =
  | 'Order.InvalidIdempotencyKey'
  | 'Order.CartEmpty'
  | 'Order.InvalidAddress'
  | 'Order.ValidationFailed';

/**
 * `409` checkout conflicts (`ERROR_CATALOG.md` §4): key reuse with a
 * different body, delisted/unavailable variant at revalidation, duplicate
 * variant lines, mixed currencies. Never retried with the same input —
 * a new `Idempotency-Key` (conflict) or corrected cart (rest) is
 * required. (`Order.CancelConflict` belongs to cancel, not checkout, and
 * is intentionally excluded.)
 */
export type CheckoutConflictErrorCode =
  | 'Order.IdempotencyConflict'
  | 'Order.VariantUnavailable'
  | 'Order.DuplicateVariant'
  | 'Order.CurrencyMismatch';

/**
 * Authentication/ownership failures around checkout (`ERROR_CATALOG.md`
 * §4): anonymous `POST /orders/checkout` → `401`; foreign cart → `403`;
 * unknown cart — or unknown/other-customer order on the follow-up read —
 * → `404` (IDOR-masked).
 */
export type CheckoutAccessErrorCode =
  | 'Order.AuthenticationRequired'
  | 'Order.QueryAuthenticationRequired'
  | 'Order.CartAccessDenied'
  | 'Order.CartNotFound'
  | 'Order.NotFound';

/**
 * Every machine-readable checkout/order failure the storefront branches
 * on. Codes are best-effort on the wire (`extensions` is `{}` on the
 * `MapError` path — `ERROR_CATALOG.md` §0), so classifiers below branch
 * on `status` first and treat `code` as a hint, never on message text.
 */
export type CheckoutOrderErrorCode =
  CheckoutValidationErrorCode | CheckoutConflictErrorCode | CheckoutAccessErrorCode;

/** Closed code set: every future branch names one of these. */
export const CHECKOUT_ORDER_ERROR_CODES: readonly CheckoutOrderErrorCode[] = [
  'Order.InvalidIdempotencyKey',
  'Order.CartEmpty',
  'Order.InvalidAddress',
  'Order.ValidationFailed',
  'Order.IdempotencyConflict',
  'Order.VariantUnavailable',
  'Order.DuplicateVariant',
  'Order.CurrencyMismatch',
  'Order.AuthenticationRequired',
  'Order.QueryAuthenticationRequired',
  'Order.CartAccessDenied',
  'Order.CartNotFound',
  'Order.NotFound',
];

/**
 * Whether `value` names a checkout/order error code. Pure — throws
 * nothing.
 */
export function isCheckoutOrderErrorCode(value: unknown): value is CheckoutOrderErrorCode {
  return (
    typeof value === 'string' && (CHECKOUT_ORDER_ERROR_CODES as readonly string[]).includes(value)
  );
}

/**
 * Minimal normalized-failure view this module classifies — alias of the
 * shared `NormalizedFailure` (Refactoring Phase E: single status-first
 * shape across features; the domain-specific idempotency classifier and
 * recovery map stay here).
 */
export type CheckoutFailure = NormalizedFailure;

/**
 * Whether the failure is a `400` validation rejection (bad key, empty
 * cart, bad address, bad params). Delegates to the shared classifier.
 * Pure.
 */
export function isCheckoutValidationFailure(failure: CheckoutFailure | null | undefined): boolean {
  return isValidationFailure(failure);
}

/**
 * Whether the failure carries field-level validation messages (the 400
 * validation shape). Delegates to the shared classifier. Pure.
 */
export function hasCheckoutFieldErrors(failure: CheckoutFailure | null | undefined): boolean {
  return hasFieldErrors(failure);
}

/**
 * Whether the failure is a `409` conflict (idempotency reuse, unavailable
 * variant, duplicate line, currency mix). Delegates to the shared
 * classifier. Pure.
 */
export function isCheckoutConflictFailure(failure: CheckoutFailure | null | undefined): boolean {
  return isConflictFailure(failure);
}

/**
 * Whether the failure is specifically an idempotency-key reuse with a
 * different body (`409`). Retry requires a NEW key — replaying the same
 * key with a changed body always conflicts. Prefers the code hint when
 * present, falls back to the `409` status. Pure — throws nothing.
 */
export function isIdempotencyConflictFailure(failure: CheckoutFailure | null | undefined): boolean {
  if (!failure || failure.status !== 409) {
    return false;
  }
  if (failure.code === undefined) {
    return true;
  }
  return failure.code === 'Order.IdempotencyConflict';
}

/**
 * Whether the failure is an authentication failure (`401` — anonymous
 * checkout or expired session). Recovery is login/refresh, never retry.
 * Delegates to the shared classifier. Pure.
 */
export function isCheckoutAuthFailure(failure: CheckoutFailure | null | undefined): boolean {
  return isAuthFailure(failure);
}

/**
 * Whether the failure is a cart-ownership rejection (`403
 * CartAccessDenied` — cart belongs to another user/guest). Recovery is
 * back-to-cart, never retry. Delegates to the shared classifier. Pure.
 */
export function isCheckoutAccessDeniedFailure(
  failure: CheckoutFailure | null | undefined,
): boolean {
  return isAccessDeniedFailure(failure);
}

/**
 * Whether the failure is a missing cart/order (`404` — unknown `cartId`
 * at checkout, or unknown/other-customer order on the follow-up read).
 * Recovery is back-to-cart / refetch. Delegates to the shared
 * classifier. Pure.
 */
export function isCheckoutNotFoundFailure(failure: CheckoutFailure | null | undefined): boolean {
  return isNotFoundFailure(failure);
}

/**
 * Whether the failure leaves entered form data safe to preserve (any
 * `4xx` checkout rejection — the backend changed nothing, so the form
 * must not be cleared). Transport failures (`status 0`) and `5xx` are
 * unknown-outcome and need explicit recovery, not silent preservation.
 * Delegates to the shared classifier. Pure.
 */
export function isFormPreservingCheckoutFailure(
  failure: CheckoutFailure | null | undefined,
): boolean {
  return isFormPreservingFailure(failure);
}

/**
 * Recovery path for a checkout failure (Sub-Phase 8.7):
 *
 * - `retry` — transport failure (`status 0`, no response received):
 *   the order may or may not exist server-side, so the safe retry
 *   reuses the SAME idempotency key + body (replay-or-create-once).
 *   Never mint a fresh key here — that risks a duplicate order.
 * - `cart` — the cart is gone or denied (`404`/`403`): the snapshot is
 *   stale by definition. Recover by re-validating the cart and guiding
 *   back to Cart — never by resubmitting against the dead snapshot.
 * - `edit` — every other rejection (validation, business conflicts,
 *   expired session, server faults): dismiss the failure with the form
 *   preserved, fix or re-authenticate, then submit as a fresh attempt
 *   (fresh key). Re-authentication itself happens through the shell —
 *   the preserved form survives it.
 */
export type CheckoutRecovery = 'retry' | 'edit' | 'cart';

/**
 * Maps a normalized checkout failure to its recovery path
 * (status-first, never message text — `ERROR_CATALOG.md` §0). `null`
 * for no failure (nothing to recover). Pure — throws nothing.
 */
export function checkoutRecoveryFor(
  failure: CheckoutFailure | null | undefined,
): CheckoutRecovery | null {
  if (failure === null || failure === undefined) {
    return null;
  }
  if (failure.status === 0) {
    return 'retry';
  }
  if (failure.status === 404 || failure.status === 403) {
    return 'cart';
  }
  return 'edit';
}
