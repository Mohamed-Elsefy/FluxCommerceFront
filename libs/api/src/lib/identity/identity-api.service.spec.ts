/**
 * Delegation tests for `IdentityApiService.registerAdmin`
 * (`POST /auth/register-admin`, SuperAdmin-only admin creation).
 *
 * `ApiClient` (the shared-lib HTTP boundary) is stubbed at its typed
 * seam so these tests own the feature logic: the canonical
 * `IDENTITY_ENDPOINTS.registerAdmin` route template, body passthrough,
 * caller-context preservation, envelope passthrough without
 * unwrapping, and error propagation untouched — the service never
 * validates, catches, remaps, logs, or throws.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiClient, ApiError, IDENTITY_ENDPOINTS, isApiError } from '@flux/api';
import type { RegisterAdminRequest, UserResponse } from '@flux/models';
import { IdentityApiService } from './identity-api.service';

const BODY: RegisterAdminRequest = {
  email: 'boss@flux.local',
  password: 'Test123!',
  firstName: 'Boss',
  lastName: 'Admin',
};

const CREATED: UserResponse = {
  id: '22222222-2222-2222-2222-222222222222',
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
  permissions: [],
};

interface ApiCalls {
  paths: string[];
  bodies: unknown[];
  options: unknown[];
}

function setup(): { service: IdentityApiService; api: ApiClient; calls: ApiCalls } {
  const calls: ApiCalls = { paths: [], bodies: [], options: [] };
  const apiStub = {
    post: vi.fn((path: string, body: unknown, options: unknown = {}) => {
      calls.paths.push(path);
      calls.bodies.push(body);
      calls.options.push(options);
      return of({ isSuccess: true, data: CREATED });
    }),
  } as unknown as ApiClient;

  TestBed.configureTestingModule({
    providers: [IdentityApiService, { provide: ApiClient, useValue: apiStub }],
  });
  return { service: TestBed.inject(IdentityApiService), api: apiStub, calls };
}

describe('IdentityApiService registerAdmin', () => {
  it('posts the admin payload to the canonical register-admin route', () => {
    const { service, calls } = setup();
    service.registerAdmin(BODY).subscribe();

    expect(calls.paths).toEqual([IDENTITY_ENDPOINTS.registerAdmin.path]);
    expect(calls.paths).toEqual(['/auth/register-admin']);
    expect(calls.bodies).toEqual([BODY]);
    expect(calls.options).toEqual([{}]);
  });

  it('preserves caller context alongside the body', () => {
    const { service, calls } = setup();
    service
      .registerAdmin(BODY, { context: { correlationId: 'corr-1', culture: 'ar' } })
      .subscribe();

    expect(calls.bodies).toEqual([BODY]);
    expect(calls.options).toEqual([{ context: { correlationId: 'corr-1', culture: 'ar' } }]);
  });

  it('passes the created-user envelope through without unwrapping data', () => {
    const { service, api } = setup();
    const envelope = {
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: CREATED,
    };
    vi.mocked(api.post).mockReturnValueOnce(of(envelope));

    let observed: unknown;
    service.registerAdmin(BODY).subscribe((value) => (observed = value));
    expect(observed).toEqual(envelope);
  });

  it('propagates validation, auth, and duplicate-email failures untouched', () => {
    const { service, api } = setup();
    for (const failure of [
      new ApiError({ status: 400, message: 'Validation.' }),
      new ApiError({ status: 401, message: 'Anonymous.' }),
      new ApiError({ status: 403, message: 'Non-SuperAdmin.' }),
      new ApiError({ status: 409, code: 'Identity.DuplicateEmail', message: 'Taken.' }),
    ]) {
      vi.mocked(api.post).mockReturnValueOnce(throwError(() => failure));

      let observed: unknown;
      service.registerAdmin(BODY).subscribe({
        error: (error: unknown) => (observed = error),
      });
      expect(observed).toBe(failure);
      expect(isApiError(observed)).toBe(true);
    }
  });
});
