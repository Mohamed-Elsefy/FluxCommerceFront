/**
 * Storefront Product Details feature models for Sub-Phases 6.1–6.6 —
 * Foundation + Page & Information + Image Gallery + Variant Selection + SKU
 * Binding + Quantity Selection.
 *
 * Scope: `docs/phases/PHASE_6_PRODUCT_DETAILS.md` §§6.1–6.6.
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
 * `sku`, `name`, `status`, deletion flags) with NO Color/Size/Style
 * dimensions and NO price/currency fields — so the selector offers the
 * backend names, selectability follows `status` + deletion flags only, and
 * nothing dimensional or commercial is fabricated.
 *
 * Commercial note (§6.5 — strictly contract-driven): the ONLY
 * customer-visible commercial field in any readable contract is
 * `VariantResponse.sku`. Price exists solely on the admin-only
 * create-variant *request* (and checkout reprices authoritatively
 * server-side); stock reads are `Admin`-only inventory endpoints — so the
 * storefront displays SKU bound to the selection and no price or
 * availability content whatsoever (see also `ARCHITECTURE.md` §21).
 *
 * Quantity note (§6.6): the contract bounds cart quantities to
 * `[Range(1, int.MaxValue)]` with backend `QuantityLimitExceeded`
 * rejection at cart time — i.e. minimum 1 is the only storefront
 * boundary, and there is no contract-defined maximum to clamp. Quantity
 * is feature-local `ProductDetailsState` (never cart/global state).
 *
 * Contract fidelity note (§6.2 rule — display only backend-provided fields):
 * no read contract exposes pricing or availability (`VariantResponse`
 * carries no price/currency fields), and SKU lives on variants whose
 * selection UI arrives in Sub-Phase 6.4 — so this sub-phase renders the
 * product name, description, and specifications only. Nothing is fabricated.
 *
 * Ownership (`ARCHITECTURE.md` §5 — feature-based architecture):
 * - Contract mirrors live in `@flux/models` and stay the single declaration
 *   site — nothing is re-declared here, so no contract drift is possible.
 * - This module only aliases the storefront-readable types and owns the
 *   pure helpers (route-parameter parsing/validation, not-found detection).
 *   Envelope mapping and fetching live in `state/` and `data-access/`.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 6.7 — no add-to-cart.
 * - Phase 7 — no cart state or cart API usage.
 */

import type { ApiError } from '@flux/api';
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
 * items: flat `VariantResponse` — `id`/`sku`/`name`/`status` plus deletion
 * flags, no option dimensions, no price/currency). Re-exported, not
 * re-declared. Selection state lives in `state/`; the selector UI lives in
 * `components/variant-selector/`.
 */
export type ProductVariant = VariantResponse;

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
