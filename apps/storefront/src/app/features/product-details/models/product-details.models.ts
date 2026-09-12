/**
 * Storefront Product Details feature models for Sub-Phases 6.1–6.3 —
 * Foundation + Page & Information + Image Gallery.
 *
 * Scope: `docs/phases/PHASE_6_PRODUCT_DETAILS.md` §§6.1–6.3.
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §§2.1/2.6/2.7
 * (`GET /catalog/products/{id:guid}` → `200 ApiResponse<ProductResponse>`;
 * `GET /catalog/products/{productId}/images` →
 * `200 ApiResponse<ProductImageResponse[]>` ordered by `displayOrder`
 * server-side; `GET .../specifications` →
 * `200 ApiResponse<ProductSpecificationResponse[]>`) and
 * `docs/frontend-contract/DTO_REFERENCE.md` §2
 * (`FluxCommerce.Modules.Catalog.Contracts` records).
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
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 6.4–6.5 — no variant selection, SKU/pricing/availability presentation.
 * - 6.6–6.7 — no quantity or add-to-cart.
 * - Phase 7 — no cart state or cart API usage.
 */

import type { ApiError } from '@flux/api';
import type {
  ProductImageResponse,
  ProductResponse,
  ProductSpecificationResponse,
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
