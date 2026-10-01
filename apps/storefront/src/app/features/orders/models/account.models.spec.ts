/**
 * Unit tests for the Sub-Phase 10.2 account feature models.
 *
 * Covers the pure helpers only (display-name resolution, read-only
 * view projection, route-path pins). The contract mirror itself
 * (`CustomerProfile` = `UserResponse`) lives in `@flux/models` (already
 * covered by Phase 1 specs) and is aliased — never re-declared — so
 * these tests assert the aliasing compiles and the helpers behave, not
 * backend shapes.
 *
 * Read-only pin: no helper under test produces an edit payload, a form
 * model, or a mutation — the view projects backend data for display
 * only.
 */

import { describe, expect, it } from 'vitest';
import type { CustomerProfile } from './account.models';
import {
  ACCOUNT_PATH,
  ACCOUNT_PROFILE_PATH,
  resolveProfileDisplayName,
  toProfileView,
} from './account.models';

function profile(overrides: Partial<CustomerProfile> = {}): CustomerProfile {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'ada@flux.local',
    roles: ['Customer'],
    isEmailVerified: true,
    registeredAtUtc: '2026-09-04T10:00:00Z',
    firstName: 'Ada',
    lastName: 'Lovelace',
    displayName: 'Ada Lovelace',
    phoneNumber: null,
    isPhoneVerified: false,
    avatarUrl: null,
    preferredLanguage: 'en',
    timeZone: 'UTC',
    status: 1,
    permissions: [],
    ...overrides,
  };
}

describe('account route paths', () => {
  it('pins the account area paths', () => {
    expect(ACCOUNT_PATH).toBe('/account');
    expect(ACCOUNT_PROFILE_PATH).toBe('/account/profile');
  });
});

describe('resolveProfileDisplayName', () => {
  it('prefers the backend display name', () => {
    expect(resolveProfileDisplayName(profile({ displayName: 'Ada L.' }))).toBe('Ada L.');
  });

  it('falls back to first + last name when the display name is absent', () => {
    expect(resolveProfileDisplayName(profile({ displayName: null }))).toBe('Ada Lovelace');
    expect(resolveProfileDisplayName(profile({ displayName: '   ' }))).toBe('Ada Lovelace');
  });

  it('falls back to the email when no name is available (never blank)', () => {
    expect(
      resolveProfileDisplayName(profile({ displayName: null, firstName: '', lastName: '  ' })),
    ).toBe('ada@flux.local');
  });
});

describe('toProfileView (read-only projection)', () => {
  it('projects backend data verbatim for display', () => {
    expect(toProfileView(profile())).toEqual({
      displayName: 'Ada Lovelace',
      email: 'ada@flux.local',
      emailVerified: true,
      phone: null,
      roles: ['Customer'],
      preferredLanguage: 'en',
      timeZone: 'UTC',
      registeredAtUtc: '2026-09-04T10:00:00Z',
    });
  });

  it('carries the phone through when the backend provides one', () => {
    expect(toProfileView(profile({ phoneNumber: '+49 170 000000' })).phone).toBe('+49 170 000000');
  });

  it('copies roles instead of aliasing them', () => {
    const source = profile({ roles: ['Customer', 'Admin'] });
    const view = toProfileView(source);
    expect(view.roles).toEqual(['Customer', 'Admin']);
    expect(view.roles).not.toBe(source.roles);
  });

  it('exposes no edit surface (no draft, no payload, no mutators)', () => {
    const view = toProfileView(profile());
    expect(view).not.toHaveProperty('draft');
    expect(view).not.toHaveProperty('form');
    expect(view).not.toHaveProperty('update');
  });
});
