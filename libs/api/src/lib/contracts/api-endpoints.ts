/**
 * Endpoint catalog for Sub-Phase 1.1 — API Contract Integration Foundation.
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §§1-7
 * (13 controllers, attribute routing only, no minimal APIs; no `/api/v1`
 * prefix — except the inconsistent `api/payments` prefix).
 *
 * This file is DATA, not behavior: route templates plus their HTTP method and
 * authentication requirement per endpoint. It performs no HTTP (no
 * `HttpClient`, no interceptors) and exists so the Sub-Phase 1.3 typed API
 * client references one canonical route table instead of scattering string
 * literals through features.
 *
 * Base URLs: `https://localhost:7119` / `http://localhost:5260` (centralized
 * in `libs/api` configuration in Sub-Phase 1.2 — never hard-coded here).
 *
 * Roles: `Customer`/`Admin`/`SuperAdmin` (`RequireRole(...)` policies);
 * `authenticated` means any valid JWT. Orders/payments additionally enforce
 * ownership (other-customer ids → `403`/`404` masked).
 *
 * Supplement S1 (Phase 21 backend): catalog writes moved from `Admin` to
 * the `catalog.manage` permission; inventory split into `inventory.read`
 * (reads) / `inventory.manage` (writes); admin orders/payments rows
 * carry their permission.
 * Supplement S2 (Phase 22 backend): `POST /auth/register-admin` moved
 * to `admins.create` (creates permission-less admins); `/admin/users`
 * reads moved to `users.read`, writes (role assign, unlock, grant,
 * revoke) plus the permission catalog document moved to
 * `users.manage`; `GET /admin/dashboard` moved to any authenticated
 * JWT (adaptive per-permission sections, never a bare forbidden
 * screen); `dashboard.read` no longer exists.
 */

import type { Permission } from '@flux/models';

/** HTTP verbs used by the backend contract. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Authentication requirement per endpoint (backend policy summary). */
export type EndpointAuth = 'anonymous' | 'authenticated' | 'admin' | 'super-admin' | Permission;

/** One catalog row: route template, verb, and who may call it. */
export interface EndpointDefinition {
  /** Route template with `{param}` placeholders (no base URL, no query). */
  readonly path: string;
  readonly method: HttpMethod;
  readonly auth: EndpointAuth;
}

/** Identity endpoints (`API_CONTRACT.md` §1, Supplement S2 v2 markers). */
export const IDENTITY_ENDPOINTS = {
  register: { path: '/auth/register', method: 'POST', auth: 'anonymous' },
  registerAdmin: { path: '/auth/register-admin', method: 'POST', auth: 'admins.create' },
  login: { path: '/auth/login', method: 'POST', auth: 'anonymous' },
  refresh: { path: '/auth/refresh', method: 'POST', auth: 'anonymous' },
  logout: { path: '/auth/logout', method: 'POST', auth: 'anonymous' },
  verifyEmail: { path: '/auth/verify-email', method: 'POST', auth: 'anonymous' },
  resendVerification: { path: '/auth/resend-verification', method: 'POST', auth: 'anonymous' },
  forgotPassword: { path: '/auth/forgot-password', method: 'POST', auth: 'anonymous' },
  resetPassword: { path: '/auth/reset-password', method: 'POST', auth: 'anonymous' },
  changePassword: { path: '/auth/change-password', method: 'POST', auth: 'authenticated' },
  me: { path: '/auth/me', method: 'GET', auth: 'authenticated' },
  assignRole: { path: '/admin/users/{id}/roles', method: 'POST', auth: 'users.manage' },
  unlockUser: { path: '/admin/users/{id}/unlock', method: 'POST', auth: 'users.manage' },
  updateProfile: { path: '/auth/profile', method: 'PUT', auth: 'authenticated' },
  listUsers: { path: '/admin/users', method: 'GET', auth: 'users.read' },
  userCounts: { path: '/admin/users/counts', method: 'GET', auth: 'users.read' },
  getUser: { path: '/admin/users/{id}', method: 'GET', auth: 'users.read' },
  grantPermission: { path: '/admin/users/{id}/permissions', method: 'POST', auth: 'users.manage' },
  revokePermission: {
    path: '/admin/users/{id}/permissions/{permission}',
    method: 'DELETE',
    auth: 'users.manage',
  },
  listUserPermissions: {
    path: '/admin/users/{id}/permissions',
    method: 'GET',
    auth: 'users.read',
  },
  permissionCatalog: { path: '/admin/users/permissions', method: 'GET', auth: 'users.manage' },
} as const satisfies Record<string, EndpointDefinition>;

/** Catalog endpoints (`API_CONTRACT.md` §2). Writes need `catalog.manage`; reads are anonymous. */
export const CATALOG_ENDPOINTS = {
  createProduct: { path: '/catalog/products', method: 'POST', auth: 'catalog.manage' },
  updateProduct: { path: '/catalog/products/{id}', method: 'PUT', auth: 'catalog.manage' },
  activateProduct: {
    path: '/catalog/products/{id}/activate',
    method: 'POST',
    auth: 'catalog.manage',
  },
  deactivateProduct: {
    path: '/catalog/products/{id}/deactivate',
    method: 'POST',
    auth: 'catalog.manage',
  },
  archiveProduct: {
    path: '/catalog/products/{id}/archive',
    method: 'POST',
    auth: 'catalog.manage',
  },
  softDeleteProduct: {
    path: '/catalog/products/{id}/soft-delete',
    method: 'POST',
    auth: 'catalog.manage',
  },
  restoreProduct: {
    path: '/catalog/products/{id}/restore',
    method: 'POST',
    auth: 'catalog.manage',
  },
  getProduct: { path: '/catalog/products/{id}', method: 'GET', auth: 'anonymous' },
  listProducts: { path: '/catalog/products', method: 'GET', auth: 'anonymous' },
  searchCatalog: { path: '/catalog', method: 'GET', auth: 'anonymous' },
  createCategory: { path: '/catalog/categories', method: 'POST', auth: 'catalog.manage' },
  updateCategory: { path: '/catalog/categories/{id}', method: 'PUT', auth: 'catalog.manage' },
  activateCategory: {
    path: '/catalog/categories/{id}/activate',
    method: 'POST',
    auth: 'catalog.manage',
  },
  deactivateCategory: {
    path: '/catalog/categories/{id}/deactivate',
    method: 'POST',
    auth: 'catalog.manage',
  },
  softDeleteCategory: {
    path: '/catalog/categories/{id}/soft-delete',
    method: 'POST',
    auth: 'catalog.manage',
  },
  restoreCategory: {
    path: '/catalog/categories/{id}/restore',
    method: 'POST',
    auth: 'catalog.manage',
  },
  getCategory: { path: '/catalog/categories/{id}', method: 'GET', auth: 'anonymous' },
  listCategories: { path: '/catalog/categories', method: 'GET', auth: 'anonymous' },
  createVariant: {
    path: '/catalog/products/{productId}/variants',
    method: 'POST',
    auth: 'catalog.manage',
  },
  createVariantsBatch: {
    path: '/catalog/products/{productId}/variants/batch',
    method: 'POST',
    auth: 'catalog.manage',
  },
  updateVariant: {
    path: '/catalog/products/{productId}/variants/{variantId}',
    method: 'PUT',
    auth: 'catalog.manage',
  },
  deleteVariant: {
    path: '/catalog/products/{productId}/variants/{variantId}',
    method: 'DELETE',
    auth: 'catalog.manage',
  },
  getVariant: {
    path: '/catalog/products/{productId}/variants/{variantId}',
    method: 'GET',
    auth: 'anonymous',
  },
  listVariants: {
    path: '/catalog/products/{productId}/variants',
    method: 'GET',
    auth: 'anonymous',
  },
  createAttributeDefinition: {
    path: '/catalog/attribute-definitions',
    method: 'POST',
    auth: 'catalog.manage',
  },
  updateAttributeDefinition: {
    path: '/catalog/attribute-definitions/{id}',
    method: 'PUT',
    auth: 'catalog.manage',
  },
  activateAttributeDefinition: {
    path: '/catalog/attribute-definitions/{id}/activate',
    method: 'POST',
    auth: 'catalog.manage',
  },
  deactivateAttributeDefinition: {
    path: '/catalog/attribute-definitions/{id}/deactivate',
    method: 'POST',
    auth: 'catalog.manage',
  },
  softDeleteAttributeDefinition: {
    path: '/catalog/attribute-definitions/{id}/soft-delete',
    method: 'POST',
    auth: 'catalog.manage',
  },
  restoreAttributeDefinition: {
    path: '/catalog/attribute-definitions/{id}/restore',
    method: 'POST',
    auth: 'catalog.manage',
  },
  getAttributeDefinition: {
    path: '/catalog/attribute-definitions/{id}',
    method: 'GET',
    auth: 'anonymous',
  },
  listAttributeDefinitions: {
    path: '/catalog/attribute-definitions',
    method: 'GET',
    auth: 'anonymous',
  },
  assignAttributeValue: {
    path: '/catalog/products/{productId}/attributes',
    method: 'POST',
    auth: 'catalog.manage',
  },
  updateAttributeValue: {
    path: '/catalog/products/{productId}/attributes/{attributeDefinitionId}',
    method: 'PUT',
    auth: 'catalog.manage',
  },
  deleteAttributeValue: {
    path: '/catalog/products/{productId}/attributes/{attributeDefinitionId}',
    method: 'DELETE',
    auth: 'catalog.manage',
  },
  getAttributeValue: {
    path: '/catalog/products/{productId}/attributes/{attributeDefinitionId}',
    method: 'GET',
    auth: 'anonymous',
  },
  listAttributeValues: {
    path: '/catalog/products/{productId}/attributes',
    method: 'GET',
    auth: 'anonymous',
  },
  addProductImage: {
    path: '/catalog/products/{productId}/images',
    method: 'POST',
    auth: 'catalog.manage',
  },
  updateProductImage: {
    path: '/catalog/products/{productId}/images/{imageId}',
    method: 'PUT',
    auth: 'catalog.manage',
  },
  deleteProductImage: {
    path: '/catalog/products/{productId}/images/{imageId}',
    method: 'DELETE',
    auth: 'catalog.manage',
  },
  setPrimaryImage: {
    path: '/catalog/products/{productId}/images/{imageId}/set-primary',
    method: 'POST',
    auth: 'catalog.manage',
  },
  reorderProductImages: {
    path: '/catalog/products/{productId}/images/reorder',
    method: 'PUT',
    auth: 'catalog.manage',
  },
  getProductImage: {
    path: '/catalog/products/{productId}/images/{imageId}',
    method: 'GET',
    auth: 'anonymous',
  },
  listProductImages: {
    path: '/catalog/products/{productId}/images',
    method: 'GET',
    auth: 'anonymous',
  },
  createSpecification: {
    path: '/catalog/products/{productId}/specifications',
    method: 'POST',
    auth: 'catalog.manage',
  },
  updateSpecification: {
    path: '/catalog/products/{productId}/specifications/{specificationId}',
    method: 'PUT',
    auth: 'catalog.manage',
  },
  deleteSpecification: {
    path: '/catalog/products/{productId}/specifications/{specificationId}',
    method: 'DELETE',
    auth: 'catalog.manage',
  },
  getSpecification: {
    path: '/catalog/products/{productId}/specifications/{specificationId}',
    method: 'GET',
    auth: 'anonymous',
  },
  listSpecifications: {
    path: '/catalog/products/{productId}/specifications',
    method: 'GET',
    auth: 'anonymous',
  },
} as const satisfies Record<string, EndpointDefinition>;

/** Cart endpoints (`API_CONTRACT.md` §3). Guest routes carry the opaque `cartId`. */
export const CART_ENDPOINTS = {
  createGuestCart: { path: '/cart/guest', method: 'POST', auth: 'anonymous' },
  getGuestCart: { path: '/cart/guest/{cartId}', method: 'GET', auth: 'anonymous' },
  addGuestItem: { path: '/cart/guest/{cartId}/items', method: 'POST', auth: 'anonymous' },
  updateGuestItem: {
    path: '/cart/guest/{cartId}/items/{variantId}',
    method: 'PUT',
    auth: 'anonymous',
  },
  removeGuestItem: {
    path: '/cart/guest/{cartId}/items/{variantId}',
    method: 'DELETE',
    auth: 'anonymous',
  },
  clearGuestCart: { path: '/cart/guest/{cartId}', method: 'DELETE', auth: 'anonymous' },
  getOrCreateCart: { path: '/cart', method: 'POST', auth: 'authenticated' },
  getCart: { path: '/cart', method: 'GET', auth: 'authenticated' },
  addItem: { path: '/cart/items', method: 'POST', auth: 'authenticated' },
  updateItem: { path: '/cart/items/{variantId}', method: 'PUT', auth: 'authenticated' },
  removeItem: { path: '/cart/items/{variantId}', method: 'DELETE', auth: 'authenticated' },
  clearCart: { path: '/cart', method: 'DELETE', auth: 'authenticated' },
  mergeCarts: { path: '/cart/merge', method: 'POST', auth: 'authenticated' },
} as const satisfies Record<string, EndpointDefinition>;

/**
 * Orders endpoints (`API_CONTRACT.md` §4). Checkout additionally requires the
 * `Idempotency-Key` header; cancel is valid only while `Pending`.
 * `listOrders` accepts an optional `status` filter (Supplement S1).
 */
export const ORDERS_ENDPOINTS = {
  checkout: { path: '/orders/checkout', method: 'POST', auth: 'authenticated' },
  listOrders: { path: '/orders', method: 'GET', auth: 'authenticated' },
  getOrder: { path: '/orders/{orderId}', method: 'GET', auth: 'authenticated' },
  cancelOrder: { path: '/orders/{orderId}/cancel', method: 'POST', auth: 'authenticated' },
} as const satisfies Record<string, EndpointDefinition>;

/**
 * Admin orders endpoints (`API_CONTRACT.md` §4.5, `[Route admin/orders]`,
 * Supplement S1). Platform-wide (no ownership scoping); each row carries
 * its permission. `refundAdminOrder` completes asynchronously via the saga.
 */
export const ADMIN_ORDERS_ENDPOINTS = {
  listAdminOrders: { path: '/admin/orders', method: 'GET', auth: 'orders.read' },
  orderCounts: { path: '/admin/orders/counts', method: 'GET', auth: 'orders.read' },
  getAdminOrder: { path: '/admin/orders/{orderId}', method: 'GET', auth: 'orders.read' },
  cancelAdminOrder: {
    path: '/admin/orders/{orderId}/cancel',
    method: 'POST',
    auth: 'orders.cancel',
  },
  refundAdminOrder: {
    path: '/admin/orders/{orderId}/refund',
    method: 'POST',
    auth: 'orders.refund',
  },
} as const satisfies Record<string, EndpointDefinition>;

/** Inventory endpoints (`API_CONTRACT.md` §5) — reads need `inventory.read`, writes need `inventory.manage`. */
export const INVENTORY_ENDPOINTS = {
  createItem: { path: '/inventory', method: 'POST', auth: 'inventory.manage' },
  getItem: { path: '/inventory/{sku}', method: 'GET', auth: 'inventory.read' },
  adjustStock: { path: '/inventory/{sku}', method: 'PATCH', auth: 'inventory.manage' },
  getReservation: {
    path: '/inventory/reservations/{id}',
    method: 'GET',
    auth: 'inventory.read',
  },
  listItems: { path: '/inventory', method: 'GET', auth: 'inventory.read' },
  itemCounts: { path: '/inventory/counts', method: 'GET', auth: 'inventory.read' },
  listReservations: { path: '/inventory/reservations', method: 'GET', auth: 'inventory.read' },
} as const satisfies Record<string, EndpointDefinition>;

/**
 * Payments endpoints (`API_CONTRACT.md` §6). The webhook is Stripe→API only
 * (raw body + `Stripe-Signature`) — the SPA must never call it.
 * `listMine` is the caller-owned customer list (Supplement S1).
 */
export const PAYMENTS_ENDPOINTS = {
  getPayment: { path: '/api/payments/{paymentId}', method: 'GET', auth: 'authenticated' },
  byOrder: { path: '/api/payments/by-order/{orderId}', method: 'GET', auth: 'authenticated' },
  listMine: { path: '/api/payments/mine', method: 'GET', auth: 'authenticated' },
  stripeWebhook: { path: '/api/payments/webhook', method: 'POST', auth: 'anonymous' },
} as const satisfies Record<string, EndpointDefinition>;

/**
 * Admin payments endpoints (`API_CONTRACT.md` §6.5, `[Route admin/payments]`,
 * Supplement S1). Read-only (no Stripe calls); each row carries its
 * permission.
 */
export const ADMIN_PAYMENTS_ENDPOINTS = {
  listAdminPayments: { path: '/admin/payments', method: 'GET', auth: 'payments.read' },
  paymentStats: { path: '/admin/payments/stats', method: 'GET', auth: 'payments.stats' },
  getAdminPayment: { path: '/admin/payments/{paymentId}', method: 'GET', auth: 'payments.read' },
} as const satisfies Record<string, EndpointDefinition>;

/**
 * Dashboard endpoint (`API_CONTRACT.md` §8, Supplement S2 adaptive).
 * Single read-only snapshot composing the per-module overviews — any
 * authenticated JWT (sections gate per permission server-side).
 */
export const DASHBOARD_ENDPOINTS = {
  getDashboard: { path: '/admin/dashboard', method: 'GET', auth: 'authenticated' },
} as const satisfies Record<string, EndpointDefinition>;

/** Health endpoints (`API_CONTRACT.md` §7) — no auth, no envelope. */
export const HEALTH_ENDPOINTS = {
  live: { path: '/health/live', method: 'GET', auth: 'anonymous' },
  ready: { path: '/health', method: 'GET', auth: 'anonymous' },
} as const satisfies Record<string, EndpointDefinition>;

/**
 * Fills a route template's `{param}` placeholders. Pure path helper used by
 * the typed API client (Sub-Phase 1.3) — performs no HTTP.
 */
export function buildEndpointPath(
  template: string,
  params: Record<string, string | number> = {},
): string {
  let path = template;
  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
  }
  return path;
}
