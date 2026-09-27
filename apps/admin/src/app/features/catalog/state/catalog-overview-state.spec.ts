/**
 * Behavior tests for the Sub-Phase 13.2 `CatalogOverviewState`.
 *
 * `CatalogAdminApiService` (already covered by its own delegation spec) is
 * stubbed at its typed seam so these tests own the state logic: the
 * combined idle → loading → success | empty | error lifecycle, verbatim
 * `totalCount` projection, duplicate-refresh prevention, retry after
 * failure, and contract-violation (dataless envelope) handling.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { defer, of, throwError, type Observable } from 'rxjs';
import { ApiError } from '@flux/api';
import { CatalogAdminApiService } from '../data-access/catalog-admin-api.service';
import { CATALOG_OVERVIEW_PAGE_SIZE, CatalogOverviewState } from './catalog-overview-state';

function page(totalCount: number, itemCount = 1) {
  return {
    isSuccess: true,
    message: 'Operation completed successfully.',
    data: {
      items: Array.from({ length: itemCount }, (_, index) => ({ id: `id-${index}` })),
      totalCount,
      pageNumber: 1,
      pageSize: CATALOG_OVERVIEW_PAGE_SIZE,
    },
  };
}

interface ApiStub {
  service: { listProducts: ReturnType<typeof vi.fn>; listCategories: ReturnType<typeof vi.fn> };
}

function setup(
  stub: Partial<{
    products: () => Observable<unknown>;
    categories: () => Observable<unknown>;
  }> = {},
): { state: CatalogOverviewState; api: ApiStub['service'] } {
  const api = {
    listProducts: vi.fn(() => stub.products?.() ?? of(page(0, 0))),
    listCategories: vi.fn(() => stub.categories?.() ?? of(page(0, 0))),
  };
  TestBed.configureTestingModule({
    providers: [CatalogOverviewState, { provide: CatalogAdminApiService, useValue: api }],
  });
  return { state: TestBed.inject(CatalogOverviewState), api };
}

describe('CatalogOverviewState lifecycle', () => {
  it('starts idle with no overview and no error', () => {
    const { state } = setup();

    expect(state.status()).toBe('idle');
    expect(state.overview()).toBeNull();
    expect(state.error()).toBeNull();
  });

  it('projects backend-issued totals verbatim on success', () => {
    const { state, api } = setup({
      products: () => of(page(42)),
      categories: () => of(page(7)),
    });
    state.refresh();

    expect(api.listProducts).toHaveBeenCalledWith({
      pageNumber: 1,
      pageSize: CATALOG_OVERVIEW_PAGE_SIZE,
    });
    expect(api.listCategories).toHaveBeenCalledWith({
      pageNumber: 1,
      pageSize: CATALOG_OVERVIEW_PAGE_SIZE,
    });
    expect(state.status()).toBe('success');
    expect(state.overview()).toEqual({ productTotal: 42, categoryTotal: 7 });
    expect(state.error()).toBeNull();
  });

  it('resolves to empty only when both slots settle empty', () => {
    const { state } = setup({
      products: () => of(page(0, 0)),
      categories: () => of(page(0, 0)),
    });
    state.refresh();

    expect(state.status()).toBe('empty');
    expect(state.overview()).toEqual({ productTotal: 0, categoryTotal: 0 });
  });

  it('stays successful when one slot is empty (zero is a fact, not absence)', () => {
    const { state } = setup({
      products: () => of(page(0, 0)),
      categories: () => of(page(3)),
    });
    state.refresh();

    expect(state.status()).toBe('success');
    expect(state.overview()).toEqual({ productTotal: 0, categoryTotal: 3 });
  });

  it('resolves to error with the normalized failure when a slot fails', () => {
    const rejection = new ApiError({ status: 403, message: 'Forbidden.' });
    const { state } = setup({ products: () => throwError(() => rejection) });
    state.refresh();

    expect(state.status()).toBe('error');
    expect(state.overview()).toBeNull();
    expect(state.error()).toBe(rejection);
  });

  it('treats a dataless envelope as a contract violation, not silent zeros', () => {
    const { state } = setup({
      products: () => of({ isSuccess: true, data: null }),
      categories: () => of(page(2)),
    });
    state.refresh();

    expect(state.status()).toBe('error');
    expect(state.overview()).toBeNull();
    expect(state.error()).toBeInstanceOf(ApiError);
  });

  it('ignores a duplicate refresh while a load is in flight', () => {
    let resolveProducts!: (value: ReturnType<typeof page>) => void;
    const pending = new Promise<ReturnType<typeof page>>((resolve) => {
      resolveProducts = resolve;
    });
    const { state, api } = setup({
      products: () => defer(() => pending),
      categories: () => of(page(1)),
    });
    state.refresh();
    state.refresh();

    expect(api.listProducts).toHaveBeenCalledTimes(1);
    resolveProducts(page(5));
    return pending.then(() => {
      expect(state.status()).toBe('success');
      expect(state.overview()).toEqual({ productTotal: 5, categoryTotal: 1 });
    });
  });

  it('retries after failure with a fresh request pair', () => {
    const rejection = new ApiError({ status: 500, message: 'Server error.' });
    const { state, api } = setup({ products: () => throwError(() => rejection) });
    state.refresh();
    expect(state.status()).toBe('error');

    vi.mocked(api.listProducts).mockReturnValueOnce(of(page(9)));
    vi.mocked(api.listCategories).mockReturnValueOnce(of(page(4)));
    state.refresh();

    expect(api.listProducts).toHaveBeenCalledTimes(2);
    expect(state.status()).toBe('success');
    expect(state.overview()).toEqual({ productTotal: 9, categoryTotal: 4 });
  });
});
