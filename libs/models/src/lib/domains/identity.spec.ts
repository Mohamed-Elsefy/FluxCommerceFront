import { describe, expect, it } from 'vitest';
import {
  USER_ROLE_FILTER_VALUES,
  USER_STATUS_FILTER_VALUES,
  isValidPermissionGrantSubmission,
  isValidUserListQuery,
} from './identity';

describe('identity transport pre-checks (Supplement S1)', () => {
  it('pins the user status/role filter vocabularies', () => {
    expect([...USER_STATUS_FILTER_VALUES]).toEqual([
      'Pending',
      'Active',
      'Suspended',
      'Locked',
      'Deleted',
    ]);
    expect([...USER_ROLE_FILTER_VALUES]).toEqual(['Customer', 'Admin', 'SuperAdmin']);
  });

  it('validates user-list queries (unknown status/role rejected)', () => {
    expect(isValidUserListQuery(null)).toBe(true);
    expect(isValidUserListQuery({ status: 'Locked', role: 'Admin' })).toBe(true);
    expect(isValidUserListQuery({ role: 'Manager' })).toBe(false);
    expect(isValidUserListQuery({ status: 'Banned' })).toBe(false);
    expect(isValidUserListQuery({ search: '' })).toBe(false);
    expect(isValidUserListQuery({ pageSize: 101 })).toBe(false);
  });

  it('validates permission grants (catalog values only)', () => {
    expect(isValidPermissionGrantSubmission({ userId: 'u', permission: 'orders.read' })).toBe(true);
    expect(isValidPermissionGrantSubmission({ userId: 'u', permission: 'orders.delete' })).toBe(
      false,
    );
    expect(isValidPermissionGrantSubmission({ userId: '', permission: 'orders.read' })).toBe(false);
    expect(isValidPermissionGrantSubmission(null)).toBe(false);
  });
});
