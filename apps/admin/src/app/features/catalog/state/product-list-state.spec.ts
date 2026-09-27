/**
 * Behavior tests for the Sub-Phase 13.3 `ProductListState`.
 *
 * `CatalogAdminApiService` (already covered by its own delegation spec) is
 * stubbed at its typed seam so these tests own the state logic: page
 * loading with defaults, page moves, reload from the effective page,
 * in-flight supersede, and contract-violation handling.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { defer, of, type Observable } from 'rxjs';
import type { ProductResponse } from '@flux/models';
import { CatalogAdminApiService } from '../data-access/catalog-admin-api.service';
import { PRODUCT_LIST_PAGE_SIZE, ProductListState } from './product-list-state';

function row(id: string): ProductResponse {
  return {
    id,
    name: `Product ${id}`,
    slug: id,
    description: null,
    seo: null,
    status: 1,
    visibility: 0,
    categoryId: 'cat-1',
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  };
}

function page(ids: string[], pageNumber: number, totalCount: number) {
  return {
    isSuccess: true,
    message: 'Operation completed successfully.',
    data: {
      items: ids.map(row),
      totalCount,
      pageNumber,
      pageSize: PRODUCT_LIST_PAGE_SIZE,
    },
  };
}

function setup(listProducts?: (query: unknown) => Observable<unknown>): {
  state: ProductListState;
  listProducts: ReturnType<typeof vi.fn>;
} {
  const listProductsMock = vi.fn(
    (query: unknown) => listProducts?.(query) ?? of(page(['p1'], 1, 1)),
  );
  TestBed.configureTestingModule({
    providers: [
      ProductListState,
      { provide: CatalogAdminApiService, useValue: { listProducts: listProductsMock } },
    ],
  });
  return { state: TestBed.inject(ProductListState), listProducts: listProductsMock };
}

describe('ProductListState', () => {
  it('starts idle with no page', () => {
    const { state } = setup();

    expect(state.page().status).toBe('idle');
    expect(state.page().data).toBeNull();
  });

  it('loads the first page with defaults', () => {
    const { state, listProducts } = setup();
    state.load();

    expect(listProducts).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 20 });
    expect(state.page().status).toBe('success');
    expect(state.page().data?.items.map((item) => item.id)).toEqual(['p1']);
  });

  it('commits page moves through setPage', () => {
    const { state, listProducts } = setup((query) => {
      const pageNumber = (query as { pageNumber: number }).pageNumber;
      return of(page([`p${pageNumber}`], pageNumber, 25));
    });
    state.load();
    state.setPage(2);

    expect(listProducts).toHaveBeenLastCalledWith({ pageNumber: 2, pageSize: 20 });
    expect(state.page().data?.pageNumber).toBe(2);
    expect(state.page().data?.items.map((item) => item.id)).toEqual(['p2']);
  });

  it('reloads the current effective page', () => {
    const { state, listProducts } = setup((query) => {
      const pageNumber = (query as { pageNumber: number }).pageNumber;
      return of(page([`p${pageNumber}`], pageNumber, 25));
    });
    state.setPage(3);
    state.reload();

    expect(listProducts).toHaveBeenCalledTimes(2);
    expect(listProducts).toHaveBeenLastCalledWith({ pageNumber: 3, pageSize: 20 });
  });

  it('resolves empty pages to empty (out-of-range is not an error)', () => {
    const { state } = setup(() => of(page([], 99, 5)));
    state.setPage(99);

    expect(state.page().status).toBe('empty');
  });

  it('supersedes in-flight loads so stale pages never settle over newer ones', () => {
    const resolvers: Array<(value: unknown) => void> = [];
    const { state, listProducts } = setup(() =>
      defer(
        () =>
          new Promise<unknown>((resolve) => {
            resolvers.push(resolve);
          }),
      ),
    );
    state.load({ pageNumber: 1 });
    state.setPage(2);

    expect(listProducts).toHaveBeenCalledTimes(2);
    resolvers[0](page(['p1'], 1, 25));
    resolvers[1](page(['p2'], 2, 25));
    return Promise.resolve().then(() => {
      expect(state.page().data?.pageNumber).toBe(2);
    });
  });

  it('treats a dataless envelope as a contract violation', () => {
    const { state } = setup(() => of({ isSuccess: true, data: null }));
    state.load();

    expect(state.page().status).toBe('error');
  });
});
