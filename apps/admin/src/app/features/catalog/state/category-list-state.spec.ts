/**
 * Behavior tests for the Sub-Phase 13.5 `CategoryListState`.
 *
 * `CatalogAdminApiService` (already covered by its own delegation spec) is
 * stubbed at its typed seam so these tests own the state logic: page
 * loading with defaults, page moves, reload from the effective page,
 * in-flight supersede, and contract-violation handling.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { defer, of, type Observable } from 'rxjs';
import type { CategoryResponse } from '@flux/models';
import { CatalogAdminApiService } from '../data-access/catalog-admin-api.service';
import { CATEGORY_LIST_PAGE_SIZE, CategoryListState } from './category-list-state';

function row(id: string): CategoryResponse {
  return {
    id,
    name: `Category ${id}`,
    slug: id,
    description: null,
    parentId: null,
    status: 0,
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
      pageSize: CATEGORY_LIST_PAGE_SIZE,
    },
  };
}

function setup(listCategories?: (query: unknown) => Observable<unknown>): {
  state: CategoryListState;
  listCategories: ReturnType<typeof vi.fn>;
} {
  const listCategoriesMock = vi.fn(
    (query: unknown) => listCategories?.(query) ?? of(page(['c1'], 1, 1)),
  );
  TestBed.configureTestingModule({
    providers: [
      CategoryListState,
      { provide: CatalogAdminApiService, useValue: { listCategories: listCategoriesMock } },
    ],
  });
  return { state: TestBed.inject(CategoryListState), listCategories: listCategoriesMock };
}

describe('CategoryListState', () => {
  it('starts idle with no page', () => {
    const { state } = setup();

    expect(state.page().status).toBe('idle');
    expect(state.page().data).toBeNull();
  });

  it('loads the first page with defaults', () => {
    const { state, listCategories } = setup();
    state.load();

    expect(listCategories).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 20 });
    expect(state.page().status).toBe('success');
    expect(state.page().data?.items.map((item) => item.id)).toEqual(['c1']);
  });

  it('commits page moves and reloads the effective page', () => {
    const { state, listCategories } = setup((query) => {
      const pageNumber = (query as { pageNumber: number }).pageNumber;
      return of(page([`c${pageNumber}`], pageNumber, 25));
    });
    state.load();
    state.setPage(2);

    expect(listCategories).toHaveBeenLastCalledWith({ pageNumber: 2, pageSize: 20 });
    expect(state.page().data?.pageNumber).toBe(2);
    state.reload();

    expect(listCategories).toHaveBeenCalledTimes(3);
    expect(listCategories).toHaveBeenLastCalledWith({ pageNumber: 2, pageSize: 20 });
  });

  it('resolves empty pages to empty and dataless envelopes to error', () => {
    const { state } = setup(() => of(page([], 99, 5)));
    state.setPage(99);
    expect(state.page().status).toBe('empty');
    TestBed.resetTestingModule();

    const dataless = setup(() => of({ isSuccess: true, data: null }));
    dataless.state.load();
    expect(dataless.state.page().status).toBe('error');
  });

  it('supersedes in-flight loads so stale pages never settle over newer ones', () => {
    const resolvers: Array<(value: unknown) => void> = [];
    const { state, listCategories } = setup(() =>
      defer(
        () =>
          new Promise<unknown>((resolve) => {
            resolvers.push(resolve);
          }),
      ),
    );
    state.load({ pageNumber: 1 });
    state.setPage(2);

    expect(listCategories).toHaveBeenCalledTimes(2);
    resolvers[0](page(['c1'], 1, 25));
    resolvers[1](page(['c2'], 2, 25));
    return Promise.resolve().then(() => {
      expect(state.page().data?.pageNumber).toBe(2);
    });
  });
});
