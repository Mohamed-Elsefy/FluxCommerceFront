/**
 * Behavior tests for the Sub-Phase 13.5 `CategoryDetailsState`.
 *
 * `CatalogAdminApiService` (already covered by its own delegation spec) is
 * stubbed at its typed seam so these tests own the state logic: slot
 * loading, lifecycle locking with success reload, and failure
 * propagation.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { defer, of, throwError, type Observable } from 'rxjs';
import { ApiError } from '@flux/api';
import type { CategoryResponse } from '@flux/models';
import { CatalogAdminApiService } from '../data-access/catalog-admin-api.service';
import { CategoryDetailsState } from './category-details-state';

function category(): CategoryResponse {
  return {
    id: 'cat-1',
    name: 'Alpha',
    slug: 'alpha',
    description: null,
    parentId: null,
    status: 0,
    isDeleted: false,
    createdAtUtc: '2026-09-04T10:00:00Z',
    deletedAtUtc: null,
  };
}

function envelope<T>(data: T) {
  return { isSuccess: true, message: 'Operation completed successfully.', data };
}

interface ServiceStub {
  getCategory: ReturnType<typeof vi.fn>;
  transitionCategory: ReturnType<typeof vi.fn>;
}

function setup(overrides: Partial<Record<keyof ServiceStub, () => Observable<unknown>>> = {}): {
  state: CategoryDetailsState;
  api: ServiceStub;
} {
  const api: ServiceStub = {
    getCategory: vi.fn(() => overrides.getCategory?.() ?? of(envelope(category()))),
    transitionCategory: vi.fn(() => overrides.transitionCategory?.() ?? of(undefined)),
  };
  TestBed.configureTestingModule({
    providers: [CategoryDetailsState, { provide: CatalogAdminApiService, useValue: api }],
  });
  return { state: TestBed.inject(CategoryDetailsState), api };
}

describe('CategoryDetailsState slots', () => {
  it('starts idle with no category', () => {
    const { state } = setup();

    expect(state.category().status).toBe('idle');
    expect(state.category().data).toBeNull();
    expect(state.transitionInFlight()).toBe(false);
  });

  it('loads the category by id and resolves failures honestly', () => {
    const { state, api } = setup();
    state.load('cat-1');

    expect(api.getCategory).toHaveBeenCalledWith('cat-1');
    expect(state.category().status).toBe('success');
    expect(state.category().data?.name).toBe('Alpha');
    TestBed.resetTestingModule();

    const rejection = new ApiError({ status: 404, message: 'Not found.' });
    const failed = setup({ getCategory: () => throwError(() => rejection) });
    failed.state.load('cat-1');
    expect(failed.state.category().status).toBe('error');
    expect(failed.state.category().error).toBe(rejection);
  });
});

describe('CategoryDetailsState transitions', () => {
  it('runs the transition, unlocks, and reloads the category on success', () => {
    const { state, api } = setup();
    state.load('cat-1');

    let settled = false;
    state.transition('cat-1', 'deactivate')?.subscribe(() => {
      settled = true;
    });

    expect(settled).toBe(true);
    expect(api.transitionCategory).toHaveBeenCalledWith('cat-1', 'deactivate');
    expect(state.transitionInFlight()).toBe(false);
    expect(api.getCategory).toHaveBeenCalledTimes(2);
  });

  it('locks concurrent transitions (duplicate-submit prevention)', () => {
    let release!: (value: unknown) => void;
    const pending = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    const { state, api } = setup({ transitionCategory: () => defer(() => pending) });

    let settled = false;
    const first = state.transition('cat-1', 'deactivate');
    first?.subscribe(() => {
      settled = true;
    });

    expect(first).not.toBeNull();
    expect(state.transition('cat-1', 'deactivate')).toBeNull();
    expect(api.transitionCategory).toHaveBeenCalledTimes(1);
    expect(state.transitionInFlight()).toBe(true);
    release(undefined);
    return pending.then(() => {
      expect(settled).toBe(true);
      expect(state.transitionInFlight()).toBe(false);
    });
  });

  it('propagates transition failures untouched without reloading', () => {
    const rejection = new ApiError({ status: 409, message: 'Conflict.' });
    const { state, api } = setup({ transitionCategory: () => throwError(() => rejection) });
    state.load('cat-1');

    let observed: unknown;
    state.transition('cat-1', 'activate')?.subscribe({
      error: (error: unknown) => {
        observed = error;
      },
    });

    expect(observed).toBe(rejection);
    expect(state.transitionInFlight()).toBe(false);
    expect(api.getCategory).toHaveBeenCalledTimes(1);
  });
});
