/**
 * Delegation tests for the Sub-Phase 13.8 `InventoryAdminApiService`.
 *
 * `ApiClient` (the shared-lib HTTP boundary, already covered by `libs/api`
 * specs) is stubbed at its typed seam so these tests own the feature logic:
 * correct route templates from `INVENTORY_ENDPOINTS`, correct `pathParams`
 * interpolation keys, verbatim bodies, envelope passthrough without
 * unwrapping, and request-options forwarding. Errors propagate untouched —
 * the service never catches.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiClient, ApiError, INVENTORY_ENDPOINTS } from '@flux/api';
import { InventoryAdminApiService } from './inventory-admin-api.service';

interface Calls {
  paths: string[];
  bodies: unknown[];
  options: unknown[];
}

function setup(): { service: InventoryAdminApiService; api: ApiClient; calls: Calls } {
  const calls: Calls = { paths: [], bodies: [], options: [] };
  const record = (path: string, body: unknown, options: unknown, result: unknown) => {
    calls.paths.push(path);
    calls.bodies.push(body);
    calls.options.push(options);
    return of(result);
  };
  const apiStub = {
    get: vi.fn((path: string, options: unknown = {}) =>
      record(path, undefined, options, { isSuccess: true, data: null }),
    ),
    post: vi.fn((path: string, body: unknown, options: unknown = {}) =>
      record(path, body, options, { isSuccess: true, data: null }),
    ),
    patch: vi.fn((path: string, body: unknown, options: unknown = {}) =>
      record(path, body, options, { isSuccess: true, data: null }),
    ),
  } as unknown as ApiClient;

  TestBed.configureTestingModule({
    providers: [InventoryAdminApiService, { provide: ApiClient, useValue: apiStub }],
  });
  return { service: TestBed.inject(InventoryAdminApiService), api: apiStub, calls };
}

describe('InventoryAdminApiService routes', () => {
  it('creates a stock item with the body verbatim', () => {
    const { service, calls } = setup();
    service.createItem({ sku: 'TEE-BLK-M', onHandQuantity: 100 }).subscribe();

    expect(calls.paths).toEqual([INVENTORY_ENDPOINTS.createItem.path]);
    expect(calls.bodies).toEqual([{ sku: 'TEE-BLK-M', onHandQuantity: 100 }]);
    expect(calls.options).toEqual([{}]);
  });

  it('reads a single stock item scoped to its SKU', () => {
    const { service, calls } = setup();
    service.getItem('TEE-BLK-M').subscribe();

    expect(calls.paths).toEqual([INVENTORY_ENDPOINTS.getItem.path]);
    expect(calls.options).toEqual([{ pathParams: { sku: 'TEE-BLK-M' } }]);
  });

  it('adjusts stock additively through the canonical route', () => {
    const { service, calls } = setup();
    service.adjustStock('TEE-BLK-M', { quantity: 25 }).subscribe();

    expect(calls.paths).toEqual([INVENTORY_ENDPOINTS.adjustStock.path]);
    expect(calls.bodies).toEqual([{ quantity: 25 }]);
    expect(calls.options).toEqual([{ pathParams: { sku: 'TEE-BLK-M' } }]);
  });

  it('reads a single reservation by id (never enumerated)', () => {
    const { service, calls } = setup();
    service.getReservation('res-1').subscribe();

    expect(calls.paths).toEqual([INVENTORY_ENDPOINTS.getReservation.path]);
    expect(calls.options).toEqual([{ pathParams: { id: 'res-1' } }]);
  });
});

describe('InventoryAdminApiService passthrough', () => {
  it('passes envelopes through without unwrapping data', () => {
    const { service, api } = setup();
    const envelope = {
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: {
        sku: 'TEE-BLK-M',
        onHandQuantity: 100,
        reservedQuantity: 2,
        availableQuantity: 98,
        updatedAtUtc: '2026-09-04T10:00:00Z',
      },
    };
    vi.mocked(api.get).mockReturnValueOnce(of(envelope));
    let observed: unknown;
    service.getItem('TEE-BLK-M').subscribe((result) => {
      observed = result;
    });

    expect(observed).toBe(envelope);
  });

  it('propagates failures untouched for feature state to normalize', () => {
    const { service, api } = setup();
    const rejection = new ApiError({ status: 409, message: 'Conflict.' });
    vi.mocked(api.post).mockReturnValueOnce(throwError(() => rejection));
    let observed: unknown;
    service.createItem({ sku: 'TEE-BLK-M', onHandQuantity: 100 }).subscribe({
      error: (error: unknown) => {
        observed = error;
      },
    });

    expect(observed).toBe(rejection);
  });

  it('forwards request options (e.g. cancellation signal) to ApiClient', () => {
    const { service, calls } = setup();
    const controller = new AbortController();
    service.getReservation('res-1', { signal: controller.signal }).subscribe();

    expect(calls.paths).toEqual([INVENTORY_ENDPOINTS.getReservation.path]);
    expect(calls.options).toEqual([{ signal: controller.signal, pathParams: { id: 'res-1' } }]);
  });
});
