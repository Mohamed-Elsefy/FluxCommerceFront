import { describe, expect, it } from 'vitest';
import {
  ADMIN_CALLABLE_CATALOG_ENDPOINTS,
  ADMIN_CALLABLE_INVENTORY_ENDPOINTS,
  ADMIN_CATALOG_CHILD_SEGMENTS,
  ADMIN_FEATURE_FOLDERS,
  ADMIN_IMAGE_MECHANISM,
  ADMIN_INVENTORY_CHILD_SEGMENTS,
  ADMIN_PHASE_13_ROUTES,
  ATTRIBUTE_DEFINITION_LIFECYCLE_ACTIONS,
  BACKEND_ADMIN_CATALOG_INVENTORY_RESPONSIBILITIES,
  CATEGORY_LIFECYCLE_ACTIONS,
  FRONTEND_ADMIN_CATALOG_INVENTORY_RESPONSIBILITIES,
  NON_PAGINATED_ADMIN_CATALOG_READS,
  PAGINATED_ADMIN_CATALOG_READS,
  PRODUCT_LIFECYCLE_ACTIONS,
  UNSUPPORTED_CATALOG_OPERATIONS,
  UNSUPPORTED_INVENTORY_OPERATIONS,
  isAdminAuthFailure,
  isAdminCallableCatalogOrInventoryEndpoint,
  isAdminConflictFailure,
  isAdminNotFoundFailure,
  isAdminPhase13Route,
  isAdminValidationFailure,
  isAttributeDefinitionLifecycleAction,
  isBackendAdminCatalogInventoryResponsibility,
  isCategoryLifecycleAction,
  isConfirmedAdminImageMechanism,
  isFrontendAdminCatalogInventoryResponsibility,
  isPaginatedAdminCatalogRead,
  isProductLifecycleAction,
  isUnsupportedCatalogOperation,
  isUnsupportedInventoryOperation,
  isValidAdminAdjustmentQuantity,
  isValidAdminPagingQuery,
  isValidAdminReservationLookupQuery,
  isValidAdminStockLookupQuery,
  supportsAdminCatalogFiltering,
  supportsAdminCatalogSorting,
} from './catalog-inventory-contract';

describe('admin-catalog-inventory-contract (Sub-Phase 13.1 audit)', () => {
  describe('lifecycle actions (audited backend surface)', () => {
    it('pins the five product lifecycle actions (no hard delete, no archive gap)', () => {
      expect([...PRODUCT_LIFECYCLE_ACTIONS]).toEqual([
        'activate',
        'deactivate',
        'archive',
        'soft-delete',
        'restore',
      ]);
    });

    it('pins the four category lifecycle actions (no archive for categories)', () => {
      expect([...CATEGORY_LIFECYCLE_ACTIONS]).toEqual([
        'activate',
        'deactivate',
        'soft-delete',
        'restore',
      ]);
      expect(CATEGORY_LIFECYCLE_ACTIONS).not.toContain('archive');
    });

    it('pins the four attribute-definition lifecycle actions (same as categories)', () => {
      expect([...ATTRIBUTE_DEFINITION_LIFECYCLE_ACTIONS]).toEqual([
        'activate',
        'deactivate',
        'soft-delete',
        'restore',
      ]);
    });

    it('classifies lifecycle actions per aggregate (no cross-talk)', () => {
      expect(isProductLifecycleAction('archive')).toBe(true);
      expect(isCategoryLifecycleAction('archive')).toBe(false);
      expect(isAttributeDefinitionLifecycleAction('archive')).toBe(false);
      expect(isProductLifecycleAction('hard-delete')).toBe(false);
      expect(isCategoryLifecycleAction(null)).toBe(false);
      expect(isAttributeDefinitionLifecycleAction(undefined)).toBe(false);
    });
  });

  describe('unsupported operations (no invented CRUD)', () => {
    it('pins catalog operations that must never be implemented', () => {
      expect([...UNSUPPORTED_CATALOG_OPERATIONS]).toEqual([
        'product-hard-delete',
        'product-status-write',
        'variant-lifecycle',
        'category-archive',
        'image-file-upload',
        'image-isPrimary-update',
        'attribute-value-attributeDefinitionId-update',
      ]);
    });

    it('pins inventory operations that must never be implemented (no mutations)', () => {
      expect([...UNSUPPORTED_INVENTORY_OPERATIONS]).not.toContain('stock-list');
      expect([...UNSUPPORTED_INVENTORY_OPERATIONS]).not.toContain('reservation-list');
      expect([...UNSUPPORTED_INVENTORY_OPERATIONS]).toContain('stock-decrement');
      expect([...UNSUPPORTED_INVENTORY_OPERATIONS]).toContain('reservation-commit');
      expect([...UNSUPPORTED_INVENTORY_OPERATIONS]).toContain('reservation-release');
    });

    it('classifies unsupported operations (unknown strings pass as supported)', () => {
      expect(isUnsupportedCatalogOperation('product-hard-delete')).toBe(true);
      expect(isUnsupportedCatalogOperation('product-create')).toBe(false);
      expect(isUnsupportedInventoryOperation('stock-list')).toBe(false);
      expect(isUnsupportedInventoryOperation('stock-lookup')).toBe(false);
      expect(isUnsupportedCatalogOperation(null)).toBe(false);
      expect(isUnsupportedInventoryOperation(42)).toBe(false);
    });
  });

  describe('pagination / filtering / sorting capability', () => {
    it('pins the three paginated reads (lists + search only)', () => {
      expect([...PAGINATED_ADMIN_CATALOG_READS]).toEqual([
        'listProducts',
        'listCategories',
        'searchCatalog',
      ]);
    });

    it('pins the five full-collection reads (never wrapped in pager logic)', () => {
      expect([...NON_PAGINATED_ADMIN_CATALOG_READS]).toEqual([
        'listVariants',
        'listAttributeDefinitions',
        'listAttributeValues',
        'listProductImages',
        'listSpecifications',
      ]);
    });

    it('classifies paginated reads (sub-resource lists are not paginated)', () => {
      expect(isPaginatedAdminCatalogRead('listProducts')).toBe(true);
      expect(isPaginatedAdminCatalogRead('listVariants')).toBe(false);
      expect(isPaginatedAdminCatalogRead('listProductImages')).toBe(false);
      expect(isPaginatedAdminCatalogRead(null)).toBe(false);
    });

    it('restricts sorting and filtering to searchCatalog only', () => {
      expect(supportsAdminCatalogSorting('searchCatalog')).toBe(true);
      expect(supportsAdminCatalogSorting('listProducts')).toBe(false);
      expect(supportsAdminCatalogSorting('listCategories')).toBe(false);
      expect(supportsAdminCatalogSorting(null)).toBe(false);
      expect(supportsAdminCatalogFiltering('searchCatalog')).toBe(true);
      expect(supportsAdminCatalogFiltering('listProducts')).toBe(false);
      expect(supportsAdminCatalogFiltering(undefined)).toBe(false);
    });

    it('validates paging bounds (>=1, 1..100, integers only)', () => {
      expect(isValidAdminPagingQuery(null)).toBe(true);
      expect(isValidAdminPagingQuery({})).toBe(true);
      expect(isValidAdminPagingQuery({ pageNumber: 1, pageSize: 20 })).toBe(true);
      expect(isValidAdminPagingQuery({ pageNumber: 0 })).toBe(false);
      expect(isValidAdminPagingQuery({ pageSize: 0 })).toBe(false);
      expect(isValidAdminPagingQuery({ pageSize: 101 })).toBe(false);
      expect(isValidAdminPagingQuery({ pageNumber: 1.5 })).toBe(false);
      expect(isValidAdminPagingQuery({ pageSize: 100 })).toBe(true);
    });
  });

  describe('lookup and adjustment pre-checks (structural only)', () => {
    it('gates stock lookups on a non-blank SKU', () => {
      expect(isValidAdminStockLookupQuery({ sku: 'TEE-BLK-M' })).toBe(true);
      expect(isValidAdminStockLookupQuery({ sku: '  ' })).toBe(false);
      expect(isValidAdminStockLookupQuery(null)).toBe(false);
      expect(isValidAdminStockLookupQuery(undefined)).toBe(false);
    });

    it('gates reservation lookups on a non-blank id', () => {
      expect(
        isValidAdminReservationLookupQuery({
          reservationId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        }),
      ).toBe(true);
      expect(isValidAdminReservationLookupQuery({ reservationId: '' })).toBe(false);
      expect(isValidAdminReservationLookupQuery(null)).toBe(false);
    });

    it('gates adjustment quantities to positive integers (additive-only)', () => {
      expect(isValidAdminAdjustmentQuantity(25)).toBe(true);
      expect(isValidAdminAdjustmentQuantity(1)).toBe(true);
      expect(isValidAdminAdjustmentQuantity(0)).toBe(false);
      expect(isValidAdminAdjustmentQuantity(-5)).toBe(false);
      expect(isValidAdminAdjustmentQuantity(1.5)).toBe(false);
      expect(isValidAdminAdjustmentQuantity('25')).toBe(false);
      expect(isValidAdminAdjustmentQuantity(null)).toBe(false);
    });
  });

  describe('image mechanism pin (URL references only)', () => {
    it('pins the URL-reference mechanism (no upload architecture)', () => {
      expect(ADMIN_IMAGE_MECHANISM).toBe('url-reference');
      expect(isConfirmedAdminImageMechanism('url-reference')).toBe(true);
      expect(isConfirmedAdminImageMechanism('file-upload')).toBe(false);
      expect(isConfirmedAdminImageMechanism('multipart')).toBe(false);
      expect(isConfirmedAdminImageMechanism('presigned-url')).toBe(false);
      expect(isConfirmedAdminImageMechanism(null)).toBe(false);
    });
  });

  describe('admin route and folder conventions', () => {
    it('pins the Phase 13 feature segments (lazy shell children)', () => {
      expect(ADMIN_PHASE_13_ROUTES.catalog).toBe('catalog');
      expect(ADMIN_PHASE_13_ROUTES.inventory).toBe('inventory');
      expect(isAdminPhase13Route('catalog')).toBe(true);
      expect(isAdminPhase13Route('inventory')).toBe(true);
      expect(isAdminPhase13Route('orders')).toBe(false);
      expect(isAdminPhase13Route(null)).toBe(false);
    });

    it('pins the planned catalog and inventory child segments', () => {
      expect([...ADMIN_CATALOG_CHILD_SEGMENTS]).toEqual(['products', 'categories']);
      expect([...ADMIN_INVENTORY_CHILD_SEGMENTS]).toEqual(['stock', 'reservations', 'adjustments']);
    });

    it('pins the feature-folder convention (ARCHITECTURE.md §5)', () => {
      expect([...ADMIN_FEATURE_FOLDERS]).toEqual([
        'pages',
        'components',
        'data-access',
        'state',
        'models',
      ]);
    });
  });

  describe('SPA-callable endpoint pins', () => {
    it('covers every catalog write/read family without inventing paths', () => {
      const paths = [...ADMIN_CALLABLE_CATALOG_ENDPOINTS];
      expect(paths).toContain('/catalog/products');
      expect(paths).toContain('/catalog/products/{id}/soft-delete');
      expect(paths).toContain('/catalog/products/{productId}/variants/batch');
      expect(paths).toContain('/catalog/products/{productId}/images/reorder');
      expect(paths).toContain('/catalog/products/{productId}/attributes/{attributeDefinitionId}');
      expect(paths).not.toContain('/catalog/products/{id}/hard-delete');
      expect(paths).not.toContain('/catalog/products/{productId}/variants/{variantId}/price');
    });

    it('pins the complete inventory surface (list, counts, and lookup templates)', () => {
      expect([...ADMIN_CALLABLE_INVENTORY_ENDPOINTS]).toEqual([
        '/inventory',
        '/inventory/{sku}',
        '/inventory/reservations/{id}',
        '/inventory/counts',
        '/inventory/reservations',
      ]);
    });

    it('classifies callable endpoints (unknown and non-string inputs fail closed)', () => {
      expect(isAdminCallableCatalogOrInventoryEndpoint('/inventory')).toBe(true);
      expect(isAdminCallableCatalogOrInventoryEndpoint('/inventory/{sku}')).toBe(true);
      expect(isAdminCallableCatalogOrInventoryEndpoint('/catalog')).toBe(true);
      expect(isAdminCallableCatalogOrInventoryEndpoint('/inventory/list')).toBe(false);
      expect(isAdminCallableCatalogOrInventoryEndpoint('/api/payments/webhook')).toBe(false);
      expect(isAdminCallableCatalogOrInventoryEndpoint(null)).toBe(false);
      expect(isAdminCallableCatalogOrInventoryEndpoint(undefined)).toBe(false);
    });
  });

  describe('failure classifiers (status-first, never message-text)', () => {
    it('branches on status: 404 missing, 409 conflict, 400 validation, 401/403 auth', () => {
      expect(isAdminNotFoundFailure({ status: 404 })).toBe(true);
      expect(isAdminNotFoundFailure({ status: 409 })).toBe(false);
      expect(isAdminConflictFailure({ status: 409 })).toBe(true);
      expect(isAdminConflictFailure({ status: 400 })).toBe(false);
      expect(isAdminValidationFailure({ status: 400 })).toBe(true);
      expect(isAdminValidationFailure({ status: 404 })).toBe(false);
      expect(isAdminAuthFailure({ status: 401 })).toBe(true);
      expect(isAdminAuthFailure({ status: 403 })).toBe(true);
      expect(isAdminAuthFailure({ status: 404 })).toBe(false);
      expect(isAdminNotFoundFailure(null)).toBe(false);
      expect(isAdminAuthFailure(undefined)).toBe(false);
    });
  });

  describe('responsibility boundary (disjoint by construction)', () => {
    it('pins the frontend-owned concerns (UX only, no truth)', () => {
      expect([...FRONTEND_ADMIN_CATALOG_INVENTORY_RESPONSIBILITIES]).toEqual([
        'catalog-ux',
        'inventory-ux',
        'typed-forms',
        'feature-state',
        'loading-error-handling',
        'navigation',
        'notifications',
        'confirmation-dialogs',
      ]);
    });

    it('pins the backend-owned concerns (the SPA must never duplicate)', () => {
      expect([...BACKEND_ADMIN_CATALOG_INVENTORY_RESPONSIBILITIES]).toContain(
        'reservation-lifecycle',
      );
      expect([...BACKEND_ADMIN_CATALOG_INVENTORY_RESPONSIBILITIES]).toContain('sku-uniqueness');
      expect([...BACKEND_ADMIN_CATALOG_INVENTORY_RESPONSIBILITIES]).toContain('price-rules');
      expect([...BACKEND_ADMIN_CATALOG_INVENTORY_RESPONSIBILITIES]).toContain('stock-state');
    });

    it('classifies responsibilities (the two sets never overlap)', () => {
      expect(isFrontendAdminCatalogInventoryResponsibility('catalog-ux')).toBe(true);
      expect(isFrontendAdminCatalogInventoryResponsibility('reservation-lifecycle')).toBe(false);
      expect(isBackendAdminCatalogInventoryResponsibility('reservation-lifecycle')).toBe(true);
      expect(isBackendAdminCatalogInventoryResponsibility('catalog-ux')).toBe(false);
      expect(isFrontendAdminCatalogInventoryResponsibility(null)).toBe(false);
      expect(isBackendAdminCatalogInventoryResponsibility(42)).toBe(false);
      for (const concern of FRONTEND_ADMIN_CATALOG_INVENTORY_RESPONSIBILITIES) {
        expect(isBackendAdminCatalogInventoryResponsibility(concern)).toBe(false);
      }
      for (const concern of BACKEND_ADMIN_CATALOG_INVENTORY_RESPONSIBILITIES) {
        expect(isFrontendAdminCatalogInventoryResponsibility(concern)).toBe(false);
      }
    });
  });
});
