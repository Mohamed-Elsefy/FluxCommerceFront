/**
 * Behavior tests for the Supplement S1 `UserDetailsState`.
 *
 * `IdentityApiService` is stubbed at its typed seam so these tests own
 * the state logic: independent details/permission slots, one-shot
 * catalog loading, grant/revoke with post-success reload, failure
 * discipline, and duplicate-submit prevention.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError, type Observable } from 'rxjs';
import { ApiError, IdentityApiService } from '@flux/api';
import { UserDetailsState } from './user-details-state';

const USER_ID = '22222222-2222-2222-2222-222222222222';

function record() {
  return {
    id: USER_ID,
    email: 'boss@flux.local',
    roles: ['Admin'],
    isEmailVerified: true,
    registeredAtUtc: '2026-09-06T12:00:00Z',
    firstName: 'Boss',
    lastName: 'Admin',
    displayName: 'Boss Admin',
    phoneNumber: null,
    isPhoneVerified: false,
    avatarUrl: null,
    preferredLanguage: 'en',
    timeZone: 'UTC',
    status: 1,
    permissions: ['orders.read'],
    failedAccessAttemptCount: 0,
    lockoutEndUtc: null,
    isLocked: false,
  };
}

function envelope(data: unknown) {
  return { isSuccess: true, message: 'Operation completed successfully.', data };
}

interface ApiStub {
  getUser: ReturnType<typeof vi.fn>;
  listUserPermissions: ReturnType<typeof vi.fn>;
  permissionCatalog: ReturnType<typeof vi.fn>;
}

function setup(
  stub: Partial<Record<'user' | 'permissions' | 'catalog', () => Observable<unknown>>> = {},
): { state: UserDetailsState; api: ApiStub } {
  const api: ApiStub = {
    getUser: vi.fn(() => stub.user?.() ?? of(envelope(record()))),
    listUserPermissions: vi.fn(() => stub.permissions?.() ?? of(envelope(['orders.read']))),
    permissionCatalog: vi.fn(() => stub.catalog?.() ?? of(envelope(['orders.read']))),
  };
  TestBed.configureTestingModule({
    providers: [UserDetailsState, { provide: IdentityApiService, useValue: api }],
  });
  return { state: TestBed.inject(UserDetailsState), api };
}

describe('UserDetailsState reads', () => {
  it('loads details and permissions into independent slots', () => {
    const { state, api } = setup();
    state.load(USER_ID);

    expect(api.getUser).toHaveBeenCalledWith(USER_ID, {});
    expect(api.listUserPermissions).toHaveBeenCalledWith(USER_ID, {});
    expect(state.details().status).toBe('success');
    expect(state.details().data?.email).toBe('boss@flux.local');
    expect(state.permissions().status).toBe('success');
    expect(state.permissions().data).toEqual(['orders.read']);
  });

  it('keeps settled user facts visible when permissions fail', () => {
    const failure = new ApiError({ status: 500, message: 'Server fault.' });
    const { state } = setup({ permissions: () => throwError(() => failure) });
    state.load(USER_ID);

    expect(state.details().status).toBe('success');
    expect(state.permissions().status).toBe('error');
    expect(state.permissions().error).toBe(failure);
  });

  it('keeps settled permissions visible when details fail', () => {
    const failure = new ApiError({ status: 404, message: 'Not found.' });
    const { state } = setup({ user: () => throwError(() => failure) });
    state.load(USER_ID);

    expect(state.details().status).toBe('error');
    expect(state.permissions().status).toBe('success');
  });

  it('loads the permission catalog once', () => {
    const { state, api } = setup();
    state.loadCatalog();
    state.loadCatalog();

    expect(api.permissionCatalog).toHaveBeenCalledTimes(1);
    expect(state.catalog().data).toEqual(['orders.read']);
  });
});
