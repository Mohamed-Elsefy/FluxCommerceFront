/**
 * Behavior tests for the Supplement S1 `UsersListState`.
 *
 * `IdentityApiService` (covered by `libs/api`) is stubbed at its typed
 * seam so these tests own the state logic: default paging, verbatim page
 * projection, filter commits with page reset, committed page moves,
 * effective-page reload, blank-filter omission, in-flight supersession,
 * and contract-violation (dataless envelope) handling.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError, type Observable } from 'rxjs';
import { ApiError, IdentityApiService } from '@flux/api';
import { USER_LIST_PAGE_SIZE, UsersListState } from './users-list-state';

function row(id: string) {
  return {
    id,
    email: `${id}@flux.local`,
    roles: ['Customer'],
    isEmailVerified: true,
    registeredAtUtc: '2026-09-04T10:00:00Z',
    firstName: 'Ada',
    lastName: 'Lovelace',
    displayName: null,
    phoneNumber: null,
    isPhoneVerified: false,
    avatarUrl: null,
    preferredLanguage: 'en',
    timeZone: 'UTC',
    status: 1,
    permissions: [],
    failedAccessAttemptCount: 0,
    lockoutEndUtc: null,
    isLocked: false,
  };
}

function page(totalCount: number, itemCount = 1, pageNumber = 1) {
  return {
    isSuccess: true,
    message: 'Operation completed successfully.',
    data: {
      items: Array.from({ length: itemCount }, (_, index) => row(`user-${index}`)),
      totalCount,
      pageNumber,
      pageSize: USER_LIST_PAGE_SIZE,
    },
  };
}

function setup(stub: Partial<{ users: () => Observable<unknown> }> = {}): {
  state: UsersListState;
  api: { listUsers: ReturnType<typeof vi.fn> };
} {
  const api = {
    listUsers: vi.fn(() => stub.users?.() ?? of(page(0, 0))),
  };
  TestBed.configureTestingModule({
    providers: [UsersListState, { provide: IdentityApiService, useValue: api }],
  });
  return { state: TestBed.inject(UsersListState), api };
}

describe('UsersListState lifecycle', () => {
  it('loads the first page by default and projects rows verbatim', () => {
    const { state, api } = setup({ users: () => of(page(2, 2)) });
    state.load();

    expect(api.listUsers).toHaveBeenCalledWith({ pageNumber: 1, pageSize: USER_LIST_PAGE_SIZE });
    expect(state.page().data?.items.map((item) => item.id)).toEqual(['user-0', 'user-1']);
    expect(state.page().data?.totalCount).toBe(2);
  });

  it('commits filters with a page reset', () => {
    const { state, api } = setup({ users: () => of(page(1, 1)) });
    state.load({ pageNumber: 4 });
    state.setFilters({ status: 'Locked', role: 'Customer', search: 'ada' });

    expect(api.listUsers).toHaveBeenLastCalledWith({
      pageNumber: 1,
      pageSize: USER_LIST_PAGE_SIZE,
      status: 'Locked',
      role: 'Customer',
      search: 'ada',
    });
  });

  it('omits blank filter values (the backend 400s on empty strings)', () => {
    const { state, api } = setup({ users: () => of(page(0, 0)) });
    state.setFilters({ status: '', role: '', search: '   ' });

    expect(api.listUsers).toHaveBeenLastCalledWith({
      pageNumber: 1,
      pageSize: USER_LIST_PAGE_SIZE,
    });
  });

  it('clears stale filters on setFilters({}) so clear reloads unfiltered', () => {
    const { state, api } = setup({ users: () => of(page(1, 1)) });
    state.setFilters({ status: 'Locked', role: 'Customer', search: 'ada' });
    state.setFilters({});

    expect(api.listUsers).toHaveBeenLastCalledWith({
      pageNumber: 1,
      pageSize: USER_LIST_PAGE_SIZE,
    });
  });

  it('commits pager moves through setPage while preserving filters', () => {
    const { state, api } = setup({ users: () => of(page(25, 1, 3)) });
    state.setFilters({ status: 'Active' });
    state.setPage(3);

    expect(api.listUsers).toHaveBeenLastCalledWith({
      pageNumber: 3,
      pageSize: USER_LIST_PAGE_SIZE,
      status: 'Active',
    });
    expect(state.page().data?.pageNumber).toBe(3);
  });

  it('reloads the current effective page', () => {
    const { state, api } = setup({ users: () => of(page(25, 1, 2)) });
    state.load({ pageNumber: 2 });
    state.reload();

    expect(api.listUsers).toHaveBeenCalledTimes(2);
    expect(api.listUsers).toHaveBeenLastCalledWith({
      pageNumber: 2,
      pageSize: USER_LIST_PAGE_SIZE,
    });
  });

  it('supersedes in-flight loads', () => {
    const { state, api } = setup();
    const first = new Subject<unknown>();
    const second = new Subject<unknown>();
    vi.mocked(api.listUsers)
      .mockReturnValueOnce(first.asObservable())
      .mockReturnValueOnce(second.asObservable());

    state.load({ pageNumber: 1 });
    state.load({ pageNumber: 2 });
    second.next(page(25, 1, 2));
    second.complete();

    expect(state.page().data?.pageNumber).toBe(2);
    first.next(page(25, 1, 1));
    expect(state.page().data?.pageNumber).toBe(2);
  });

  it('treats dataless envelopes as contract violations', () => {
    const { state } = setup({ users: () => of({ isSuccess: true, message: 'ok' }) });
    state.load();

    expect(state.page().status).toBe('error');
    expect(state.page().data).toBeNull();
  });

  it('lands backend failures in the error slot untouched', () => {
    const failure = new ApiError({ status: 403, message: 'Forbidden.' });
    const { state } = setup({ users: () => throwError(() => failure) });
    state.load();

    expect(state.page().status).toBe('error');
    expect(state.page().error).toBe(failure);
  });
});
