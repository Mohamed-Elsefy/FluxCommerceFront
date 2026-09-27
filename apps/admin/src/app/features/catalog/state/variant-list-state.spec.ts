/**
 * Behavior tests for the Sub-Phase 13.4 `VariantListState`.
 *
 * `CatalogAdminApiService` (already covered by its own delegation spec) is
 * stubbed at its typed seam so these tests own the state logic: scoped
 * loading, empty/error lifecycles, navigation supersede, and
 * contract-violation handling.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { defer, of, throwError, type Observable } from 'rxjs';
import { ApiError } from '@flux/api';
import type { VariantResponse } from '@flux/models';
import { CatalogAdminApiService } from '../data-access/catalog-admin-api.service';
import { VariantListState } from './variant-list-state';

function variant(id: string): VariantResponse {
  return {
    id,
    productId: 'prod-1',
    sku: `SKU-${id}`,
    name: `Variant ${id}`,
    unitPriceAmount: 9.99,
    currency: 'USD',
    status: 0,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  };
}

function setup(listVariants?: () => Observable<unknown>): {
  state: VariantListState;
  listVariants: ReturnType<typeof vi.fn>;
} {
  const listVariantsMock = vi.fn(() => listVariants?.() ?? of(envelope([variant('v1')])));
  TestBed.configureTestingModule({
    providers: [
      VariantListState,
      { provide: CatalogAdminApiService, useValue: { listVariants: listVariantsMock } },
    ],
  });
  return { state: TestBed.inject(VariantListState), listVariants: listVariantsMock };
}

function envelope<T>(data: T) {
  return { isSuccess: true, message: 'Operation completed successfully.', data };
}

describe('VariantListState', () => {
  it('starts idle with no variants', () => {
    const { state } = setup();

    expect(state.variants().status).toBe('idle');
    expect(state.variants().data).toBeNull();
  });

  it('loads the full collection scoped to the product', () => {
    const { state, listVariants } = setup(() => of(envelope([variant('v1'), variant('v2')])));
    state.load('prod-1');

    expect(listVariants).toHaveBeenCalledWith('prod-1');
    expect(state.variants().status).toBe('success');
    expect(state.variants().data?.map((item) => item.id)).toEqual(['v1', 'v2']);
  });

  it('resolves empty collections and failures honestly', () => {
    const empty = setup(() => of(envelope([])));
    empty.state.load('prod-1');
    expect(empty.state.variants().status).toBe('empty');
    TestBed.resetTestingModule();

    const rejection = new ApiError({ status: 404, message: 'Not found.' });
    const failed = setup(() => throwError(() => rejection));
    failed.state.load('prod-1');
    expect(failed.state.variants().status).toBe('error');
    expect(failed.state.variants().error).toBe(rejection);
    TestBed.resetTestingModule();

    const dataless = setup(() => of({ isSuccess: true, data: null }));
    dataless.state.load('prod-1');
    expect(dataless.state.variants().status).toBe('error');
  });

  it('supersedes in-flight loads across product navigation', () => {
    const resolvers: Array<(value: unknown) => void> = [];
    const { state, listVariants } = setup(() =>
      defer(
        () =>
          new Promise<unknown>((resolve) => {
            resolvers.push(resolve);
          }),
      ),
    );
    state.load('prod-1');
    state.load('prod-2');

    expect(listVariants).toHaveBeenCalledTimes(2);
    resolvers[0](envelope([variant('v1')]));
    resolvers[1](envelope([variant('v2')]));
    return Promise.resolve().then(() => {
      expect(state.variants().data?.map((item) => item.id)).toEqual(['v2']);
    });
  });
});
