/**
 * Delegation tests for the Sub-Phase 6.1–6.2 `ProductDetailsApiService`.
 *
 * `ApiClient` (the shared-lib HTTP boundary, already covered by `libs/api`
 * specs) is stubbed at its typed seam so these tests own the feature logic:
 * correct route templates from `CATALOG_ENDPOINTS`, correct `pathParams`
 * interpolation keys, envelope passthrough without unwrapping, and
 * request-options forwarding. Errors propagate untouched — the service never
 * catches.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiClient, ApiError, CATALOG_ENDPOINTS } from '@flux/api';
import { ProductDetailsApiService } from './product-details-api.service';

interface ApiCalls {
  paths: string[];
  options: unknown[];
}

function setup(): { service: ProductDetailsApiService; api: ApiClient; calls: ApiCalls } {
  const calls: ApiCalls = { paths: [], options: [] };
  const apiStub = {
    get: vi.fn((path: string, options: unknown = {}) => {
      calls.paths.push(path);
      calls.options.push(options);
      return of({ isSuccess: true, data: null });
    }),
  } as unknown as ApiClient;

  TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: apiStub }] });
  return { service: TestBed.inject(ProductDetailsApiService), api: apiStub, calls };
}

describe('ProductDetailsApiService routes', () => {
  it('reads a single product through the canonical route template', () => {
    const { service, calls } = setup();
    service.getProduct('11111111-1111-1111-1111-111111111111').subscribe();

    expect(calls.paths).toEqual([CATALOG_ENDPOINTS.getProduct.path]);
    expect(calls.options).toEqual([{ pathParams: { id: '11111111-1111-1111-1111-111111111111' } }]);
  });

  it('lists specifications through the canonical route template', () => {
    const { service, calls } = setup();
    service.listSpecifications('11111111-1111-1111-1111-111111111111').subscribe();

    expect(calls.paths).toEqual([CATALOG_ENDPOINTS.listSpecifications.path]);
    expect(calls.options).toEqual([
      { pathParams: { productId: '11111111-1111-1111-1111-111111111111' } },
    ]);
  });
});

describe('ProductDetailsApiService passthrough', () => {
  it('passes envelopes through without unwrapping data', () => {
    const { service, api } = setup();
    const envelope = {
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Tee',
        slug: 'tee',
        categoryId: '22222222-2222-2222-2222-222222222222',
      },
    };
    vi.mocked(api.get).mockReturnValueOnce(of(envelope));
    let observed: unknown;
    service.getProduct('11111111-1111-1111-1111-111111111111').subscribe((result) => {
      observed = result;
    });

    expect(observed).toBe(envelope);
  });

  it('propagates failures untouched for feature state to normalize', () => {
    const { service, api } = setup();
    const rejection = new ApiError({ status: 404, message: 'Not found.' });
    vi.mocked(api.get).mockReturnValueOnce(throwError(() => rejection));
    let observed: unknown;
    service.getProduct('00000000-0000-0000-0000-000000000000').subscribe({
      error: (error: unknown) => {
        observed = error;
      },
    });

    expect(observed).toBe(rejection);
  });

  it('propagates specification failures untouched for feature state to normalize', () => {
    const { service, api } = setup();
    const rejection = new ApiError({ status: 404, message: 'Not found.' });
    vi.mocked(api.get).mockReturnValueOnce(throwError(() => rejection));
    let observed: unknown;
    service.listSpecifications('00000000-0000-0000-0000-000000000000').subscribe({
      error: (error: unknown) => {
        observed = error;
      },
    });

    expect(observed).toBe(rejection);
  });

  it('forwards request options (e.g. cancellation signal) to ApiClient', () => {
    const { service, calls } = setup();
    const controller = new AbortController();
    service
      .getProduct('11111111-1111-1111-1111-111111111111', { signal: controller.signal })
      .subscribe();

    expect(calls.options[0]).toMatchObject({ signal: controller.signal });
  });
});
