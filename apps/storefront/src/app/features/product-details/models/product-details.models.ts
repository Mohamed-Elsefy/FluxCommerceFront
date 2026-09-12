/**
 * Storefront Product Details feature models for Sub-Phase 6.1 — Product
 * Details Foundation.
 *
 * Scope: `docs/phases/PHASE_6_PRODUCT_DETAILS.md` §6.1.
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §2.1
 * (`GET /catalog/products/{id:guid}` → `200 ApiResponse<ProductResponse>`)
 * and `docs/frontend-contract/DTO_REFERENCE.md` §2
 * (`FluxCommerce.Modules.Catalog.Contracts` records).
 *
 * Ownership (`ARCHITECTURE.md` §5 — feature-based architecture):
 * - Contract mirrors live in `@flux/models` and stay the single declaration
 *   site — nothing is re-declared here, so no contract drift is possible.
 * - This module only aliases the storefront-readable details type and owns
 *   the pure route-parameter helpers (parsing, validation). Envelope mapping
 *   and fetching live in `state/` and `data-access/`.
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 6.2 — no view models for info/spec presentation.
 * - 6.3 — no image-gallery state.
 * - 6.4–6.7 — no variants, SKU/pricing/availability, quantity, add-to-cart.
 * - Phase 7 — no cart state or cart API usage.
 */

import type { ProductResponse } from '@flux/models';

/**
 * Product details read model (`GET /catalog/products/{id}`).
 * Re-exported — not re-declared — so the backend shape stays canonical.
 */
export type ProductDetails = ProductResponse;

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
