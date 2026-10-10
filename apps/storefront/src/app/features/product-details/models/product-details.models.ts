/**
 * Storefront Product Details feature models for Sub-Phases 6.1–6.7 —
 * Foundation + Page & Information + Image Gallery + Variant Selection + SKU
 * Binding + Quantity Selection + Add to Cart Integration.
 *
 * Scope: `docs/phases/PHASE_6_PRODUCT_DETAILS.md` §§6.1–6.7.
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §§2.1/2.3/2.6/2.7
 * (`GET /catalog/products/{id:guid}` → `200 ApiResponse<ProductResponse>`;
 * `GET /catalog/products/{productId}/variants` →
 * `200 ApiResponse<VariantResponse[]>` (no pagination);
 * `GET /catalog/products/{productId}/images` →
 * `200 ApiResponse<ProductImageResponse[]>` ordered by `displayOrder`
 * server-side; `GET .../specifications` →
 * `200 ApiResponse<ProductSpecificationResponse[]>`) and
 * `docs/frontend-contract/DTO_REFERENCE.md` §2
 * (`FluxCommerce.Modules.Catalog.Contracts` records).
 *
 * Variant-structure note (§6.4 — display only backend-provided fields):
 * the contract models variants as a flat list (`VariantResponse`: `id`,
 * `sku`, `name`, backend-issued `unitPriceAmount` + `currency`, `status`,
 * deletion flags) with NO Color/Size/Style dimensions — so the selector
 * offers the backend names, selectability follows `status` + deletion
 * flags only, and nothing dimensional is fabricated.
 *
 * Commercial note (§6.5 — strictly contract-driven, lifted by the
 * priced-variant contract change — see ADR 018): the customer-visible
 * commercial fields are `VariantResponse.sku` plus the backend-issued
 * `unitPriceAmount` + `currency` snapshot. The storefront displays both
 * bound to the selection (price formatted per culture, display only —
 * never an input to math); stock reads stay `Admin`-only inventory
 * endpoints, so no availability content is rendered (see also
 * `ARCHITECTURE.md` §21).
 *
 * Quantity note (§6.6): the contract bounds cart quantities to
 * `[Range(1, int.MaxValue)]` with backend `QuantityLimitExceeded`
 * rejection at cart time — i.e. minimum 1 is the only storefront
 * boundary, and there is no contract-defined maximum to clamp. Quantity
 * is feature-local `ProductDetailsState` (never cart/global state).
 *
 * Integration note (§6.7 — the Product Details → Cart boundary, unblocked
 * by the priced-variant contract change — see ADR 018): the phase's
 * "selected purchasable item and quantity" is exactly `AddToCartItem`
 * (`variantId` + `quantity`, validated, `null` when unsubmittable). The
 * wire bodies (`AddCartItemRequest`) additionally require
 * `unitPriceAmount` + `currency` — now sourced from the selected
 * backend-issued variant snapshot via `toAddToCartPricing` (validated,
 * `null` when absent) and carried explicitly as `AddToCartPricing`: no
 * price is ever defaulted, estimated, or fabricated here. Guest `cartId`
 * lifecycle is owned by the cart feature (`GuestCartService`, Phase 7.5 —
 * the page establishes it and passes the id to
 * `submitGuestAddToCart`); authenticated submission stays parked for
 * Phase 8/7.6 auth branching.
 *
 * Contract fidelity note (§6.2 rule — display only backend-provided fields):
 * pricing and availability render only from backend-issued variant
 * snapshots, and SKU lives on variants whose selection UI arrives in
 * Sub-Phase 6.4 — the page renders the product name, description, and
 * specifications plus the selection-bound SKU/price. Nothing is fabricated.
 *
 * Ownership (`ARCHITECTURE.md` §5 — feature-based architecture):
 * - Contract mirrors live in `@flux/models` and stay the single declaration
 *   site — nothing is re-declared here, so no contract drift is possible.
 * - This module only aliases the storefront-readable types and owns the
 *   pure helpers (route-parameter parsing/validation, not-found detection).
 *   Envelope mapping and fetching live in `state/` and `data-access/`.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - Phase 7 — no cart pages, cart state, guest persistence, or merge.
 */

import type { ApiError, ResourceStatus } from '@flux/api';
import { VariantStatus } from '@flux/models';
import type {
  ProductImageResponse,
  ProductResponse,
  ProductSpecificationResponse,
  VariantResponse,
} from '@flux/models';

/**
 * Product details read model (`GET /catalog/products/{id}`).
 * Re-exported — not re-declared — so the backend shape stays canonical.
 */
export type ProductDetails = ProductResponse;

/**
 * Product specification read model
 * (`GET /catalog/products/{productId}/specifications` items: `name`/`value`,
 * both non-null per the contract). Re-exported, not re-declared.
 */
export type ProductSpecification = ProductSpecificationResponse;

/**
 * Product image read model (`GET /catalog/products/{productId}/images`
 * items, ordered by `displayOrder` server-side). Re-exported, not
 * re-declared. Selection/fallback behavior lives in the gallery component;
 * fetching lives in `data-access/` + `state/`.
 */
export type ProductImage = ProductImageResponse;

/**
 * Product variant read model (`GET /catalog/products/{productId}/variants`
 * items: flat `VariantResponse` — `id`/`sku`/`name`, backend-issued
 * `unitPriceAmount` + `currency`, `status` plus deletion flags, no option
 * dimensions). Re-exported, not re-declared. Selection state lives in
 * `state/`; the selector UI lives in `components/variant-selector/`.
 */
export type ProductVariant = VariantResponse;

/**
 * Similar product read model (`GET /catalog/products` items: full
 * `ProductResponse` with `primaryImage`). Re-exported, not re-declared.
 * The rail drops the current product client-side — the backend offers no
 * exclusion parameter.
 */
export type SimilarProduct = ProductResponse;

/** Route parameter carrying the product id (`/catalog/products/:id`). */
export const PRODUCT_DETAILS_ID_PARAM = 'id';

/**
 * GUID shape mirroring the backend `{id:guid}` route constraint
 * (`API_CONTRACT.md` §2.1). Structural only — existence and ownership stay
 * backend-validated (`404` flows into the error state).
 */
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Extracts the product id from the `:id` route parameter.
 *
 * Returns the trimmed id when it is a well-formed GUID, otherwise `null`
 * (missing, blank, or malformed). `null` means "do not fetch" — the page
 * renders the invalid-id state instead of sending a doomed request. Pure —
 * performs no HTTP and throws nothing.
 */
export function parseProductIdParam(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const candidate = value.trim();
  return GUID_PATTERN.test(candidate) ? candidate : null;
}

/**
 * Detects the "Product Not Found" case from a normalized `ApiError`.
 * Branching on `status` follows the wire reality (`ERROR_CATALOG` §0 — the
 * machine-readable code is not on the wire for business errors): `404` from
 * either details endpoint means the product is unknown. Pure — throws
 * nothing, treats missing errors as "not a not-found".
 */
export function isNotFoundError(error: ApiError | null | undefined): boolean {
  return error?.status === 404;
}

/**
 * Whether a variant can be selected: backend `Active` status and not
 * soft-deleted. Inactive or deleted variants render disabled and can never
 * become the selection. Pure — throws nothing.
 */
export function isSelectableVariant(variant: ProductVariant): boolean {
  return variant.status === VariantStatus.Active && !variant.isDeleted;
}

/**
 * Resolves a requested variant id against the loaded list: returns the id
 * when it names a selectable variant, otherwise `null` (unknown id,
 * inactive/deleted variant, or nothing loaded). The single guard behind
 * both the selector emit path and the state transition — invalid
 * selections are impossible by construction. Pure — throws nothing.
 */
export function resolveVariantSelection(
  variants: readonly ProductVariant[] | null | undefined,
  requestedId: string | null | undefined,
): string | null {
  if (requestedId === null || requestedId === undefined || requestedId.trim() === '') {
    return null;
  }
  const match = variants?.find((variant) => variant.id === requestedId) ?? null;
  return match !== null && isSelectableVariant(match) ? match.id : null;
}

/**
 * Minimum purchasable quantity. Mirrors the contract's cart quantity floor
 * (`[Range(1, int.MaxValue)]` on every cart item request —
 * `API_CONTRACT.md` §3): the storefront clamps nothing above this because
 * the contract defines no maximum (over-limit quantities are a backend
 * `QuantityLimitExceeded` rejection at cart/checkout time, owned by
 * Phases 6.7/7).
 */
export const MIN_QUANTITY = 1;

/** Starting quantity: always a valid value (§6.6 acceptance). */
export const INITIAL_QUANTITY = 1;

/**
 * Whether `value` is a submittable quantity: an integer of at least
 * `MIN_QUANTITY`. Rejects negatives, zero, decimals, `NaN`, and
 * non-finite values. Pure — throws nothing.
 */
export function isValidQuantity(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_QUANTITY;
}

/**
 * Parses raw textbox text into a quantity: digits-only (after trimming)
 * mapping to a valid quantity, otherwise `null`. Rejects empty text,
 * signs, decimals, and any non-digit characters — so invalid keystrokes
 * never reach feature state. Pure — throws nothing.
 */
export function parseQuantityInput(text: string | null | undefined): number | null {
  if (text === null || text === undefined) {
    return null;
  }
  const candidate = text.trim();
  if (!/^[0-9]+$/.test(candidate)) {
    return null;
  }
  const parsed = Number.parseInt(candidate, 10);
  return isValidQuantity(parsed) ? parsed : null;
}

/** Add-to-Cart request lifecycle (button-facing projection of the submission store). */
export type AddToCartStatus = 'idle' | 'adding' | 'added' | 'error';

/**
 * Maps a resource status onto the button lifecycle. `empty` is unreachable
 * for the object-shaped cart payload (the default emptiness rule only
 * matches nullish/array data) and folds to `idle` defensively. Pure.
 */
export function toAddToCartStatus(status: ResourceStatus): AddToCartStatus {
  switch (status) {
    case 'loading':
      return 'adding';
    case 'success':
      return 'added';
    case 'error':
      return 'error';
    default:
      return 'idle';
  }
}

/**
 * The phase's "selected purchasable item and quantity": a validated
 * variant id plus a validated quantity. Price/currency travel separately
 * (`AddToCartPricing`, projected from the selected variant via
 * `toAddToCartPricing`) because they snapshot backend-issued variant
 * pricing — never defaulted here.
 */
export interface AddToCartItem {
  variantId: string;
  quantity: number;
}

/**
 * Builds the submittable purchasable item: the variant id when a
 * selectable variant is given plus a valid quantity, otherwise `null`
 * (nothing selected, unselectable variant, or invalid quantity). The
 * single builder behind the submission path — unsubmittable states can
 * never produce a payload. Pure — throws nothing.
 */
export function buildAddToCartItem(
  variant: ProductVariant | null | undefined,
  quantity: number,
): AddToCartItem | null {
  if (variant === null || variant === undefined || !isSelectableVariant(variant)) {
    return null;
  }
  if (!isValidQuantity(quantity)) {
    return null;
  }
  return { variantId: variant.id, quantity };
}

/**
 * Price snapshot completing the wire body (`AddCartItemRequest`).
 * Structural echo of the backend `DataAnnotations`
 * (`[Range(0.01, max)]`, 3-letter currency) — a request-shape pre-check,
 * not business logic. Supplied explicitly by the caller from the
 * selected variant snapshot (`toAddToCartPricing`); see the integration
 * note above.
 */
export interface AddToCartPricing {
  unitPriceAmount: number;
  currency: string;
}

/**
 * Whether a pricing snapshot is structurally submittable: finite amount
 * within the contract range and an ISO-4217-shaped (upper, 3-letter)
 * currency. Pure — throws nothing.
 */
export function isValidAddToCartPricing(pricing: AddToCartPricing | null | undefined): boolean {
  if (pricing === null || pricing === undefined) {
    return false;
  }
  return (
    Number.isFinite(pricing.unitPriceAmount) &&
    pricing.unitPriceAmount >= 0.01 &&
    /^[A-Z]{3}$/.test(pricing.currency)
  );
}

/**
 * Projects the submittable price snapshot out of a variant: the
 * backend-issued `unitPriceAmount` + `currency` when structurally valid,
 * otherwise `null` (missing or malformed snapshot — the page disables
 * submission instead of sending a doomed request). The single projection
 * site for variant → wire pricing — display formatting (`formatCurrency`)
 * stays at the page. Pure — throws nothing.
 */
export function toAddToCartPricing(
  variant: ProductVariant | null | undefined,
): AddToCartPricing | null {
  if (variant === null || variant === undefined) {
    return null;
  }
  const pricing: AddToCartPricing = {
    unitPriceAmount: variant.unitPriceAmount,
    currency: variant.currency,
  };
  return isValidAddToCartPricing(pricing) ? pricing : null;
}
