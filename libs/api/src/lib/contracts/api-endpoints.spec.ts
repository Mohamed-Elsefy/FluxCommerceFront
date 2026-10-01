import { describe, expect, it } from 'vitest';
import {
  ADMIN_ORDERS_ENDPOINTS,
  ADMIN_PAYMENTS_ENDPOINTS,
  CATALOG_ENDPOINTS,
  DASHBOARD_ENDPOINTS,
  IDENTITY_ENDPOINTS,
  INVENTORY_ENDPOINTS,
  PAYMENTS_ENDPOINTS,
  buildEndpointPath,
} from './api-endpoints';

describe('buildEndpointPath', () => {
  it('fills route placeholders with encoded values', () => {
    expect(buildEndpointPath('/catalog/products/{id}', { id: 'p1' })).toBe('/catalog/products/p1');
    expect(
      buildEndpointPath('/catalog/products/{productId}/variants/{variantId}', {
        productId: 'p 1',
        variantId: 42,
      }),
    ).toBe('/catalog/products/p%201/variants/42');
  });

  it('leaves templates untouched without params', () => {
    expect(buildEndpointPath('/catalog/products')).toBe('/catalog/products');
  });

  it('fills catalog endpoint templates end to end', () => {
    expect(
      buildEndpointPath(CATALOG_ENDPOINTS.updateVariant.path, {
        productId: 'p1',
        variantId: 'v2',
      }),
    ).toBe('/catalog/products/p1/variants/v2');
  });
});

describe('supplement S1 endpoint tables (Step S1.2)', () => {
  it('pins the identity growth rows (profile + SuperAdmin users/permissions)', () => {
    expect(IDENTITY_ENDPOINTS.updateProfile).toEqual({
      path: '/auth/profile',
      method: 'PUT',
      auth: 'authenticated',
    });
    expect(IDENTITY_ENDPOINTS.listUsers).toEqual({
      path: '/admin/users',
      method: 'GET',
      auth: 'super-admin',
    });
    expect(IDENTITY_ENDPOINTS.userCounts.path).toBe('/admin/users/counts');
    expect(IDENTITY_ENDPOINTS.getUser.path).toBe('/admin/users/{id}');
    expect(IDENTITY_ENDPOINTS.grantPermission).toEqual({
      path: '/admin/users/{id}/permissions',
      method: 'POST',
      auth: 'super-admin',
    });
    expect(IDENTITY_ENDPOINTS.revokePermission).toEqual({
      path: '/admin/users/{id}/permissions/{permission}',
      method: 'DELETE',
      auth: 'super-admin',
    });
    expect(IDENTITY_ENDPOINTS.permissionCatalog.path).toBe('/admin/users/permissions');
  });

  it('fills the revoke-permission template end to end', () => {
    expect(
      buildEndpointPath(IDENTITY_ENDPOINTS.revokePermission.path, {
        id: 'u1',
        permission: 'orders.read',
      }),
    ).toBe('/admin/users/u1/permissions/orders.read');
  });

  it('migrates catalog writes to catalog.manage (reads stay anonymous)', () => {
    expect(CATALOG_ENDPOINTS.createProduct.auth).toBe('catalog.manage');
    expect(CATALOG_ENDPOINTS.updateVariant.auth).toBe('catalog.manage');
    expect(CATALOG_ENDPOINTS.deleteSpecification.auth).toBe('catalog.manage');
    expect(CATALOG_ENDPOINTS.getProduct.auth).toBe('anonymous');
    expect(CATALOG_ENDPOINTS.listVariants.auth).toBe('anonymous');
  });

  it('splits inventory auth (reads vs writes) and adds the list rows', () => {
    expect(INVENTORY_ENDPOINTS.createItem.auth).toBe('inventory.manage');
    expect(INVENTORY_ENDPOINTS.adjustStock.auth).toBe('inventory.manage');
    expect(INVENTORY_ENDPOINTS.getItem.auth).toBe('inventory.read');
    expect(INVENTORY_ENDPOINTS.getReservation.auth).toBe('inventory.read');
    expect(INVENTORY_ENDPOINTS.listItems).toEqual({
      path: '/inventory',
      method: 'GET',
      auth: 'inventory.read',
    });
    expect(INVENTORY_ENDPOINTS.itemCounts.path).toBe('/inventory/counts');
    expect(INVENTORY_ENDPOINTS.listReservations.path).toBe('/inventory/reservations');
  });

  it('pins the admin orders rows with their permissions', () => {
    expect(ADMIN_ORDERS_ENDPOINTS.listAdminOrders).toEqual({
      path: '/admin/orders',
      method: 'GET',
      auth: 'orders.read',
    });
    expect(ADMIN_ORDERS_ENDPOINTS.orderCounts.auth).toBe('orders.read');
    expect(ADMIN_ORDERS_ENDPOINTS.getAdminOrder.auth).toBe('orders.read');
    expect(ADMIN_ORDERS_ENDPOINTS.cancelAdminOrder.auth).toBe('orders.cancel');
    expect(ADMIN_ORDERS_ENDPOINTS.refundAdminOrder).toEqual({
      path: '/admin/orders/{orderId}/refund',
      method: 'POST',
      auth: 'orders.refund',
    });
  });

  it('pins the customer mine row plus the admin payments rows', () => {
    expect(PAYMENTS_ENDPOINTS.listMine).toEqual({
      path: '/api/payments/mine',
      method: 'GET',
      auth: 'authenticated',
    });
    expect(ADMIN_PAYMENTS_ENDPOINTS.listAdminPayments.auth).toBe('payments.read');
    expect(ADMIN_PAYMENTS_ENDPOINTS.paymentStats).toEqual({
      path: '/admin/payments/stats',
      method: 'GET',
      auth: 'payments.stats',
    });
    expect(ADMIN_PAYMENTS_ENDPOINTS.getAdminPayment.auth).toBe('payments.read');
  });

  it('pins the dashboard row', () => {
    expect(DASHBOARD_ENDPOINTS.getDashboard).toEqual({
      path: '/admin/dashboard',
      method: 'GET',
      auth: 'dashboard.read',
    });
  });
});
