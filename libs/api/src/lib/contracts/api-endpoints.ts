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
 */

/** HTTP verbs used by the backend contract. */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Authentication requirement per endpoint (backend policy summary). */
export type EndpointAuth = 'anonymous' | 'authenticated' | 'admin' | 'super-admin';

/** One catalog row: route template, verb, and who may call it. */
export interface EndpointDefinition {
  /** Route template with `{param}` placeholders (no base URL, no query). */
  readonly path: string;
  readonly method: HttpMethod;
  readonly auth: EndpointAuth;
}

/** Identity endpoints (`API_CONTRACT.md` §1). */
export const IDENTITY_ENDPOINTS = {
  register: { path: '/auth/register', method: 'POST', auth: 'anonymous' },
  registerAdmin: { path: '/auth/register-admin', method: 'POST', auth: 'super-admin' },
  login: { path: '/auth/login', method: 'POST', auth: 'anonymous' },
  refresh: { path: '/auth/refresh', method: 'POST', auth: 'anonymous' },
  logout: { path: '/auth/logout', method: 'POST', auth: 'anonymous' },
  verifyEmail: { path: '/auth/verify-email', method: 'POST', auth: 'anonymous' },
  resendVerification: { path: '/auth/resend-verification', method: 'POST', auth: 'anonymous' },
  forgotPassword: { path: '/auth/forgot-password', method: 'POST', auth: 'anonymous' },
  resetPassword: { path: '/auth/reset-password', method: 'POST', auth: 'anonymous' },
  changePassword: { path: '/auth/change-password', method: 'POST', auth: 'authenticated' },
  me: { path: '/auth/me', method: 'GET', auth: 'authenticated' },
  assignRole: { path: '/admin/users/{id}/roles', method: 'POST', auth: 'super-admin' },
  unlockUser: { path: '/admin/users/{id}/unlock', method: 'POST', auth: 'super-admin' },
} as const satisfies Record<string, EndpointDefinition>;

/** Catalog endpoints (`API_CONTRACT.md` §2). Writes need `Admin`; reads are anonymous. */
export const CATALOG_ENDPOINTS = {
  createProduct: { path: '/catalog/products', method: 'POST', auth: 'admin' },
  updateProduct: { path: '/catalog/products/{id}', method: 'PUT', auth: 'admin' },
  activateProduct: { path: '/catalog/products/{id}/activate', method: 'POST', auth: 'admin' },
  deactivateProduct: { path: '/catalog/products/{id}/deactivate', method: 'POST', auth: 'admin' },
  archiveProduct: { path: '/catalog/products/{id}/archive', method: 'POST', auth: 'admin' },
  softDeleteProduct: { path: '/catalog/products/{id}/soft-delete', method: 'POST', auth: 'admin' },
  restoreProduct: { path: '/catalog/products/{id}/restore', method: 'POST', auth: 'admin' },
  getProduct: { path: '/catalog/products/{id}', method: 'GET', auth: 'anonymous' },
  listProducts: { path: '/catalog/products', method: 'GET', auth: 'anonymous' },
  searchCatalog: { path: '/catalog', method: 'GET', auth: 'anonymous' },
  createCategory: { path: '/catalog/categories', method: 'POST', auth: 'admin' },
  updateCategory: { path: '/catalog/categories/{id}', method: 'PUT', auth: 'admin' },
  activateCategory: { path: '/catalog/categories/{id}/activate', method: 'POST', auth: 'admin' },
  deactivateCategory: {
    path: '/catalog/categories/{id}/deactivate',
    method: 'POST',
    auth: 'admin',
  },
  softDeleteCategory: {
    path: '/catalog/categories/{id}/soft-delete',
    method: 'POST',
    auth: 'admin',
  },
  restoreCategory: { path: '/catalog/categories/{id}/restore', method: 'POST', auth: 'admin' },
  getCategory: { path: '/catalog/categories/{id}', method: 'GET', auth: 'anonymous' },
  listCategories: { path: '/catalog/categories', method: 'GET', auth: 'anonymous' },
  createVariant: { path: '/catalog/products/{productId}/variants', method: 'POST', auth: 'admin' },
  createVariantsBatch: {
    path: '/catalog/products/{productId}/variants/batch',
    method: 'POST',
    auth: 'admin',
  },
  updateVariant: {
    path: '/catalog/products/{productId}/variants/{variantId}',
    method: 'PUT',
    auth: 'admin',
  },
  deleteVariant: {
    path: '/catalog/products/{productId}/variants/{variantId}',
    method: 'DELETE',
    auth: 'admin',
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
    auth: 'admin',
  },
  updateAttributeDefinition: {
    path: '/catalog/attribute-definitions/{id}',
    method: 'PUT',
    auth: 'admin',
  },
  activateAttributeDefinition: {
    path: '/catalog/attribute-definitions/{id}/activate',
    method: 'POST',
    auth: 'admin',
  },
  deactivateAttributeDefinition: {
    path: '/catalog/attribute-definitions/{id}/deactivate',
    method: 'POST',
    auth: 'admin',
  },
  softDeleteAttributeDefinition: {
    path: '/catalog/attribute-definitions/{id}/soft-delete',
    method: 'POST',
    auth: 'admin',
  },
  restoreAttributeDefinition: {
    path: '/catalog/attribute-definitions/{id}/restore',
    method: 'POST',
    auth: 'admin',
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
    auth: 'admin',
  },
  updateAttributeValue: {
    path: '/catalog/products/{productId}/attributes/{attributeDefinitionId}',
    method: 'PUT',
    auth: 'admin',
  },
  deleteAttributeValue: {
    path: '/catalog/products/{productId}/attributes/{attributeDefinitionId}',
    method: 'DELETE',
    auth: 'admin',
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
  addProductImage: { path: '/catalog/products/{productId}/images', method: 'POST', auth: 'admin' },
  updateProductImage: {
    path: '/catalog/products/{productId}/images/{imageId}',
    method: 'PUT',
    auth: 'admin',
  },
  deleteProductImage: {
    path: '/catalog/products/{productId}/images/{imageId}',
    method: 'DELETE',
    auth: 'admin',
  },
  setPrimaryImage: {
    path: '/catalog/products/{productId}/images/{imageId}/set-primary',
    method: 'POST',
    auth: 'admin',
  },
  reorderProductImages: {
    path: '/catalog/products/{productId}/images/reorder',
    method: 'PUT',
    auth: 'admin',
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
    auth: 'admin',
  },
  updateSpecification: {
    path: '/catalog/products/{productId}/specifications/{specificationId}',
    method: 'PUT',
    auth: 'admin',
  },
  deleteSpecification: {
    path: '/catalog/products/{productId}/specifications/{specificationId}',
    method: 'DELETE',
    auth: 'admin',
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
 */
export const ORDERS_ENDPOINTS = {
  checkout: { path: '/orders/checkout', method: 'POST', auth: 'authenticated' },
  listOrders: { path: '/orders', method: 'GET', auth: 'authenticated' },
  getOrder: { path: '/orders/{orderId}', method: 'GET', auth: 'authenticated' },
  cancelOrder: { path: '/orders/{orderId}/cancel', method: 'POST', auth: 'authenticated' },
} as const satisfies Record<string, EndpointDefinition>;

/** Inventory endpoints (`API_CONTRACT.md` §5) — Admin only. */
export const INVENTORY_ENDPOINTS = {
  createItem: { path: '/inventory', method: 'POST', auth: 'admin' },
  getItem: { path: '/inventory/{sku}', method: 'GET', auth: 'admin' },
  adjustStock: { path: '/inventory/{sku}', method: 'PATCH', auth: 'admin' },
  getReservation: { path: '/inventory/reservations/{id}', method: 'GET', auth: 'admin' },
} as const satisfies Record<string, EndpointDefinition>;

/**
 * Payments endpoints (`API_CONTRACT.md` §6). The webhook is Stripe→API only
 * (raw body + `Stripe-Signature`) — the SPA must never call it.
 */
export const PAYMENTS_ENDPOINTS = {
  getPayment: { path: '/api/payments/{paymentId}', method: 'GET', auth: 'authenticated' },
  byOrder: { path: '/api/payments/by-order/{orderId}', method: 'GET', auth: 'authenticated' },
  stripeWebhook: { path: '/api/payments/webhook', method: 'POST', auth: 'anonymous' },
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
