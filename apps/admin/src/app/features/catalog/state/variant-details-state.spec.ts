/**
 * Behavior tests for the Sub-Phase 13.4 `VariantDetailsState`.
 *
 * `CatalogAdminApiService` (already covered by its own delegation spec) is
 * stubbed at its typed seam so these tests own the state logic: scoped
 * loading, error lifecycles, navigation supersede, and
 * contract-violation handling.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { defer, of, throwError, type Observable } from 'rxjs';
import { ApiError } from '@flux/api';
import type { VariantResponse } from '@flux/models';
import { CatalogAdminApiService } from '../data-access/catalog-admin-api.service';
import { VariantDetailsState } from './variant-details-state';

function variant(): VariantResponse {
  return {
    id: 'var-1',
    productId: 'prod-1',
    sku: 'TEE-BLK-M',
    name: 'Black / M',
    unitPriceAmount: 29.99,
    currency: 'USD',
    status: 0,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  };
}

function setup(getVariant?: () => Observable<unknown>): {
  state: VariantDetailsState;
  getVariant: ReturnType<typeof vi.fn>;
} {
  const getVariantMock = vi.fn(
    () => getVariant?.() ?? of({ isSuccess: true, message: 'Ok.', data: variant() }),
  );
  TestBed.configureTestingModule({
    providers: [
      VariantDetailsState,
      { provide: CatalogAdminApiService, useValue: { getVariant: getVariantMock } },
    ],
  });
  return { state: TestBed.inject(VariantDetailsState), getVariant: getVariantMock };
}

describe('VariantDetailsState', () => {
  it('starts idle with no variant', () => {
    const { state } = setup();

    expect(state.variant().status).toBe('idle');
    expect(state.variant().data).toBeNull();
  });

  it('loads the variant scoped to its product', () => {
    const { state, getVariant } = setup();
    state.load('prod-1', 'var-1');

    expect(getVariant).toHaveBeenCalledWith('prod-1', 'var-1');
    expect(state.variant().status).toBe('success');
    expect(state.variant().data?.sku).toBe('TEE-BLK-M');
  });

  it('resolves failures and dataless envelopes to error', () => {
    const rejection = new ApiError({ status: 404, message: 'Not found.' });
    const failed = setup(() => throwError(() => rejection));
    failed.state.load('prod-1', 'var-1');
    expect(failed.state.variant().status).toBe('error');
    expect(failed.state.variant().error).toBe(rejection);
    TestBed.resetTestingModule();

    const dataless = setup(() => of({ isSuccess: true, data: null }));
    dataless.state.load('prod-1', 'var-1');
    expect(dataless.state.variant().status).toBe('error');
    expect(dataless.state.variant().error).toBeInstanceOf(ApiError);
  });

  it('supersedes in-flight loads across variant navigation', () => {
    const resolvers: Array<(value: unknown) => void> = [];
    const deferred = () =>
      defer(
        () =>
          new Promise<unknown>((resolve) => {
            resolvers.push(resolve);
          }),
      );
    const { state, getVariant } = setup(deferred);
    state.load('prod-1', 'var-1');
    state.load('prod-1', 'var-2');

    expect(getVariant).toHaveBeenCalledTimes(2);
    resolvers[0]({ isSuccess: true, message: 'Ok.', data: { ...variant(), id: 'var-1' } });
    resolvers[1]({ isSuccess: true, message: 'Ok.', data: { ...variant(), id: 'var-2' } });
    return Promise.resolve().then(() => {
      expect(state.variant().data?.id).toBe('var-2');
    });
  });
});
