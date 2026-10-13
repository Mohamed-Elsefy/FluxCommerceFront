/**
 * Cart contract mirrors for Sub-Phase 1.1.
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §3 and
 * `docs/frontend-contract/DTO_REFERENCE.md` §3
 * (`FluxCommerce.Modules.Cart.Contracts` records, `[Route cart][Authorize]`).
 *
 * Notes:
 * - Cart requests DO use `DataAnnotations` (`[Required]`/`[Range]`/
 *   `[StringLength]` → `400` before handlers run).
 * - `Add*` carries price snapshot + quantity; `Update*` carries quantity only;
 *   `Remove*` carries the variant id only.
 * - Timestamps are `DateTimeOffset` (ISO-8601 strings). `userId` null = guest.
 * - `version` is the OCC token (starts at 1, ++ per mutation);
 *   `VersionConflict` → refetch with `GET` and retry.
 * - Guest = `AllowAnonymous` + opaque `cartId` in the route (persist in
 *   localStorage); authenticated = JWT user, no id in the route.
 */

import type { Guid, IsoDateString } from '../common/shared-types';

/** `POST /cart/guest/{cartId}/items` + `POST /cart/items` body. */
export interface AddCartItemRequest {
  variantId: Guid;
  unitPriceAmount: number;
  currency: string;
  quantity: number;
}

/**
 * `PUT .../items/{variantId}` body — quantity only, no price/currency.
 * The route id wins on disagreement.
 */
export interface UpdateCartItemQuantityRequest {
  variantId: Guid;
  quantity: number;
}

/** `POST /cart/merge` body — call after login; atomic guest→user merge. */
export interface MergeCartRequest {
  guestCartId: Guid;
}

/** Cart line — no `lineTotal`; compute client-side, never float-math money. */
export interface CartItemResponse {
  productId: Guid;
  variantId: Guid;
  sku: string;
  productName: string;
  unitPriceAmount: number;
  currency: string;
  quantity: number;
}

/** Every cart endpoint returns `ApiResponse<CartResponse>`. */
export interface CartResponse {
  cartId: Guid;
  userId?: Guid | null;
  version: number;
  createdAtUtc: IsoDateString;
  updatedAtUtc: IsoDateString;
  items: CartItemResponse[];
  isGuest: boolean;
  isAuthenticated: boolean;
}
