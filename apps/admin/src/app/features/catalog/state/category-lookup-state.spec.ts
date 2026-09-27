/**
 * Behavior tests for the Sub-Phase 13.3 `CategoryLookupState`.
 *
 * `CatalogAdminApiService` (already covered by its own delegation spec) is
 * stubbed at its typed seam so these tests own the state logic: the
 * load-once guard, item unwrapping, option projection, and
 * contract-violation handling.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { defer, of, throwError, type Observable } from 'rxjs';
import { ApiError } from '@flux/api';
import type { CategoryResponse } from '@flux/models';
import { CatalogAdminApiService } from '../data-access/catalog-admin-api.service';
import { CATEGORY_LOOKUP_PAGE_SIZE, CategoryLookupState } from './category-lookup-state';

function category(id: string, name: string): CategoryResponse {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    description: null,
    parentId: null,
    status: 0,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  };
}

function page(items: CategoryResponse[]) {
  return {
    isSuccess: true,
    message: 'Operation completed successfully.',
    data: { items, totalCount: items.length, pageNumber: 1, pageSize: CATEGORY_LOOKUP_PAGE_SIZE },
  };
}

function setup(listCategories?: () => Observable<unknown>): {
  state: CategoryLookupState;
  listCategories: ReturnType<typeof vi.fn>;
} {
  const listCategoriesMock = vi.fn(() => listCategories?.() ?? of(page([])));
  TestBed.configureTestingModule({
    providers: [
      CategoryLookupState,
      { provide: CatalogAdminApiService, useValue: { listCategories: listCategoriesMock } },
    ],
  });
  return { state: TestBed.inject(CategoryLookupState), listCategories: listCategoriesMock };
}

describe('CategoryLookupState', () => {
  it('starts idle with no options', () => {
    const { state } = setup();

    expect(state.categories().status).toBe('idle');
    expect(state.options()).toEqual([]);
  });

  it('loads the snapshot at the backend maximum page and projects options', () => {
    const { state, listCategories } = setup(() =>
      of(page([category('c2', 'Beta'), category('c1', 'Alpha')])),
    );
    state.load();

    expect(listCategories).toHaveBeenCalledWith({ pageNumber: 1, pageSize: 100 });
    expect(state.categories().status).toBe('success');
    expect(state.options()).toEqual([
      { value: 'c2', label: 'Beta' },
      { value: 'c1', label: 'Alpha' },
    ]);
  });

  it('ignores duplicate loads while in flight', () => {
    let release!: (value: unknown) => void;
    const pending = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    const { state, listCategories } = setup(() => defer(() => pending));
    state.load();
    state.load();

    expect(listCategories).toHaveBeenCalledTimes(1);
    release(page([category('c1', 'Alpha')]));
    return pending.then(() => {
      expect(state.options()).toEqual([{ value: 'c1', label: 'Alpha' }]);
    });
  });

  it('refetches settled snapshots so later visits render backend-current data', () => {
    const { state, listCategories } = setup(() => of(page([category('c1', 'Alpha')])));
    state.load();
    expect(state.options()).toEqual([{ value: 'c1', label: 'Alpha' }]);

    state.load();

    expect(listCategories).toHaveBeenCalledTimes(2);
    expect(state.options()).toEqual([{ value: 'c1', label: 'Alpha' }]);
  });

  it('resolves failures to error', () => {
    const rejection = new ApiError({ status: 403, message: 'Forbidden.' });
    const { state } = setup(() => throwError(() => rejection));
    state.load();

    expect(state.categories().status).toBe('error');
    expect(state.categories().error).toBe(rejection);
  });

  it('resolves dataless envelopes to error', () => {
    TestBed.resetTestingModule();
    const { state } = setup(() => of({ isSuccess: true, data: null }));
    state.load();

    expect(state.categories().status).toBe('error');
    expect(state.categories().error).toBeInstanceOf(ApiError);
  });
});
