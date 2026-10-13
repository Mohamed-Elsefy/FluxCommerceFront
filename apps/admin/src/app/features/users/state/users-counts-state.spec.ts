/**
 * Behavior tests for the Supplement S1 `UsersCountsState`.
 *
 * `IdentityApiService` is stubbed at its typed seam so these tests own
 * the state logic: verbatim counts projection, reload, in-flight
 * supersession, and contract-violation handling.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError, type Observable } from 'rxjs';
import { ApiError, IdentityApiService } from '@flux/api';
import { UsersCountsState } from './users-counts-state';

function counts() {
  return {
    isSuccess: true,
    message: 'Operation completed successfully.',
    data: {
      total: 7,
      pending: 1,
      active: 5,
      suspended: 0,
      locked: 1,
      deleted: 0,
      customers: 5,
      admins: 1,
      superAdmins: 1,
      unverified: 1,
      lockedOut: 1,
    },
  };
}

function setup(stub: Partial<{ counts: () => Observable<unknown> }> = {}): {
  state: UsersCountsState;
  api: { userCounts: ReturnType<typeof vi.fn> };
} {
  const api = {
    userCounts: vi.fn(() => stub.counts?.() ?? of(counts())),
  };
  TestBed.configureTestingModule({
    providers: [UsersCountsState, { provide: IdentityApiService, useValue: api }],
  });
  return { state: TestBed.inject(UsersCountsState), api };
}

describe('UsersCountsState lifecycle', () => {
  it('loads the counts snapshot verbatim', () => {
    const { state, api } = setup();
    state.load();

    expect(api.userCounts).toHaveBeenCalledTimes(1);
    expect(state.counts().status).toBe('success');
    expect(state.counts().data?.total).toBe(7);
    expect(state.counts().data?.lockedOut).toBe(1);
  });

  it('reloads on demand', () => {
    const { state, api } = setup();
    state.load();
    state.reload();

    expect(api.userCounts).toHaveBeenCalledTimes(2);
  });

  it('supersedes in-flight loads', () => {
    const { state, api } = setup();
    const first = new Subject<unknown>();
    const second = new Subject<unknown>();
    vi.mocked(api.userCounts)
      .mockReturnValueOnce(first.asObservable())
      .mockReturnValueOnce(second.asObservable());
    state.load();
    state.load();

    expect(api.userCounts).toHaveBeenCalledTimes(2);
    first.next(counts());
    expect(state.counts().status).toBe('loading');
    second.next(counts());
    expect(state.counts().status).toBe('success');
  });

  it('treats dataless envelopes as contract violations', () => {
    const { state } = setup({ counts: () => of({ isSuccess: true, message: 'ok' }) });
    state.load();

    expect(state.counts().status).toBe('error');
    expect(state.counts().data).toBeNull();
  });

  it('lands backend failures in the error slot untouched', () => {
    const failure = new ApiError({ status: 403, message: 'Forbidden.' });
    const { state } = setup({ counts: () => throwError(() => failure) });
    state.load();

    expect(state.counts().status).toBe('error');
    expect(state.counts().error).toBe(failure);
  });
});
