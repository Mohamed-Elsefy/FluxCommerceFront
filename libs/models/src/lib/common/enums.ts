/**
 * Backend enum mirrors for Sub-Phase 1.1 — API Contract Integration Foundation.
 *
 * Source of truth: `docs/frontend-contract/ENUM_REFERENCE.md` (which itself
 * mirrors `*.Contracts.Enums` ↔ `*.Domain.Enums`).
 *
 * Critical wire rule (ENUM_REFERENCE §1): the backend registers only
 * `NullableGuidJsonConverter` — there is NO `JsonStringEnumConverter`. Every
 * enum-typed JSON body field and every enum-typed response field is therefore
 * a NUMBER on the wire. The only exceptions are `OrderStatus` and
 * `PaymentStatus`, which travel as STRINGS (`OrderStatus.ToString()` /
 * `PaymentStatus.ToString()`) and are typed here as string unions.
 *
 * Query-string enums (`GET /catalog?...`) are lenient: the backend model
 * binder accepts case-insensitive names or numbers (`?status=Active` ≡
 * `?status=1`). JSON bodies must send numbers.
 *
 * Synchronization rule: when a backend enum gains a value, extend the matching
 * declaration here (same member, same number, same position) and never reuse
 * a retired number. Unknown future values must not crash the UI — use the
 * helpers below (`enumLabelOf`, `isSellableProduct`, `isTerminalOrderStatus`).
 */

/** `UserResponse.status` — number on the wire. See ENUM_REFERENCE §1. */
export enum UserStatus {
  Pending = 0,
  Active = 1,
  Suspended = 2,
  Locked = 3,
  Deleted = 4,
}

/** Backend role constants (`Identity.Domain.Aggregates.Roles`). Strings, not an enum. */
export type UserRole = 'Customer' | 'Admin' | 'SuperAdmin';

/**
/**
 * Action-level permission catalog v3 (`Identity.Domain.Aggregates.PermissionCatalog`,
 * JWT claim type `"permission"` — one claim per granted permission).
 * `dashboard.read` was removed in the Phase 22 evolution and
 * `users.manage` / `admins.create` were removed with it (user writes
 * are not delegable — only `SuperAdmin` performs them); `users.read`
 * remains for delegated reads. Assigning the `Admin` role grants
 * nothing — every permission is granted manually afterwards; grants
 * apply on the next login/refresh; `SuperAdmin` bypasses every gate
 * without holding permissions. Source of truth:
 * `docs/frontend-contract/API_CONTRACT.md` §0.5 (Supplement S3, Step S3.2).
 */
export const PERMISSION_CATALOG = [
  'orders.read',
  'orders.cancel',
  'orders.refund',
  'payments.read',
  'payments.stats',
  'inventory.read',
  'inventory.manage',
  'catalog.manage',
  'users.read',
] as const;

/** One action-level permission value. Strings, not an enum. */
export type Permission = (typeof PERMISSION_CATALOG)[number];

/**
 * Whether `value` names a catalog permission. Pure — throws nothing.
 */
export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && (PERMISSION_CATALOG as readonly string[]).includes(value);
}

/** `ProductResponse.status` — number on the wire. See ENUM_REFERENCE §2. */
export enum ProductStatus {
  Draft = 0,
  Active = 1,
  Inactive = 2,
  Archived = 3,
}

/** `Create/UpdateProductRequest.visibility`, `ProductResponse.visibility` — number on the wire. */
export enum ProductVisibility {
  Visible = 0,
  Hidden = 1,
}

/** `CategoryResponse.status` — number on the wire (no Draft/Archived). */
export enum CategoryStatus {
  Active = 0,
  Inactive = 1,
}

/** `VariantResponse.status` — number on the wire (no Draft/Archived). */
export enum VariantStatus {
  Active = 0,
  Inactive = 1,
}

/** `AttributeDefinitionResponse.status` — number on the wire. */
export enum AttributeStatus {
  Active = 0,
  Inactive = 1,
}

/**
 * `Create/UpdateAttributeDefinitionRequest.dataType`,
 * `AttributeDefinitionResponse.dataType`, `ProductAttributeValueResponse.dataType`.
 * Number on the wire; `value` itself stays a string shaped per this type.
 */
export enum AttributeDataType {
  Text = 0,
  Number = 1,
  Decimal = 2,
  Boolean = 3,
  Date = 4,
  DateTime = 5,
}

/** `GET /catalog?sortBy=` — number on the wire, name accepted in query strings only. */
export enum CatalogProductSortBy {
  Name = 0,
  CreatedAtUtc = 1,
}

/** `GET /catalog?sortDirection=` — number on the wire, name accepted in query strings only. */
export enum CatalogProductSortDirection {
  Ascending = 0,
  Descending = 1,
}

/**
 * `CheckoutResponse.status`, `OrderSummaryResponse.status`,
 * `OrderDetailsResponse.status`. STRING on the wire (`OrderStatus.ToString()`).
 */
export type OrderStatus = 'Pending' | 'Cancelled' | 'Confirmed';

/** `InventoryReservationResponse.status` (Admin) — number on the wire. */
export enum InventoryReservationStatus {
  Pending = 0,
  Committed = 1,
  Released = 2,
  Expired = 3,
}

/**
 * `GET /api/payments/{id}.status`. STRING on the wire
 * (`PaymentStatus.ToString()`).
 */
export type PaymentStatus =
  'Pending' | 'Processing' | 'Succeeded' | 'Failed' | 'Cancelled' | 'Refunded';

/** Display labels for numeric enums, keyed by wire value. */
export const ProductStatusLabel: Record<number, string> = {
  [ProductStatus.Draft]: 'Draft',
  [ProductStatus.Active]: 'Active',
  [ProductStatus.Inactive]: 'Inactive',
  [ProductStatus.Archived]: 'Archived',
};

/**
 * Forward-compatible label lookup: unknown future numeric values render as
 * `Unknown (<n>)` instead of crashing. See ENUM_REFERENCE §8.
 */
export function enumLabelOf(labels: Record<number, string>, value: number | string): string {
  if (typeof value === 'string') {
    return value;
  }
  return labels[value] ?? `Unknown (${value})`;
}

/**
 * Sellability rule: `ProductStatus` is lifecycle, `ProductVisibility` is
 * exposure — both gates apply. See ENUM_REFERENCE §5.
 */
export function isSellableProduct(status: ProductStatus, visibility: ProductVisibility): boolean {
  return status === ProductStatus.Active && visibility === ProductVisibility.Visible;
}

/** Terminal order states: polling may stop. See ENUM_REFERENCE §8. */
export function isTerminalOrderStatus(status: OrderStatus | string): boolean {
  return status === 'Cancelled' || status === 'Confirmed';
}
