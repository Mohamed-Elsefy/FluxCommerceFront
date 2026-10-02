import { describe, expect, it } from 'vitest';
import { UserStatus } from '@flux/models';
import { emptyUsersOverview, userStatusDisplay } from './users-admin.models';

describe('users admin models', () => {
  it('builds a zeroed overview', () => {
    expect(emptyUsersOverview()).toEqual({
      total: 0,
      pending: 0,
      active: 0,
      suspended: 0,
      locked: 0,
      deleted: 0,
      customers: 0,
      admins: 0,
      superAdmins: 0,
      unverified: 0,
      lockedOut: 0,
    });
  });

  it('maps every user status to a localized badge', () => {
    expect(userStatusDisplay(UserStatus.Pending)).toEqual({
      labelKey: 'users.status.pending',
      variant: 'warning',
    });
    expect(userStatusDisplay(UserStatus.Active)).toEqual({
      labelKey: 'users.status.active',
      variant: 'success',
    });
    expect(userStatusDisplay(UserStatus.Suspended)).toEqual({
      labelKey: 'users.status.suspended',
      variant: 'warning',
    });
    expect(userStatusDisplay(UserStatus.Locked)).toEqual({
      labelKey: 'users.status.locked',
      variant: 'danger',
    });
    expect(userStatusDisplay(UserStatus.Deleted)).toEqual({
      labelKey: 'users.status.deleted',
      variant: 'neutral',
    });
  });

  it('falls back verbatim-neutral on unknown statuses', () => {
    expect(userStatusDisplay(99)).toEqual({
      labelKey: 'users.status.unknown',
      variant: 'neutral',
    });
  });
});
