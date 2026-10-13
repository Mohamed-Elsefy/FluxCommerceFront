import { describe, expect, it } from 'vitest';
import { roleGuard } from '@flux/auth';
import { UserDetailsState } from './state/user-details-state';
import { UsersCountsState } from './state/users-counts-state';
import { UsersListState } from './state/users-list-state';
import { usersRoutes } from './users.routes';

describe('usersRoutes', () => {
  it('provides the feature states once at the feature root', () => {
    const root = usersRoutes.find((route) => route.path === '');

    expect(root?.providers).toEqual([UsersListState, UsersCountsState, UserDetailsState]);
  });

  it('mounts the landing, list, creation, and details pages without placeholders', () => {
    const root = usersRoutes.find((route) => route.path === '');
    const paths = root?.children?.map((route) => route.path);

    expect(paths).toEqual(['', 'list', 'new', ':id']);
    for (const child of root?.children ?? []) {
      expect(typeof child.loadComponent).toBe('function');
    }
  });

  it('guards creation with the SuperAdmin role (list and details inherit the mount gate)', () => {
    const root = usersRoutes.find((route) => route.path === '');
    const creation = root?.children?.find((route) => route.path === 'new');
    const list = root?.children?.find((route) => route.path === 'list');
    const details = root?.children?.find((route) => route.path === ':id');

    expect(creation?.canActivate).toEqual([roleGuard]);
    expect(creation?.data?.['roles']).toEqual(['SuperAdmin']);
    expect(list?.canActivate).toBeUndefined();
    expect(details?.canActivate).toBeUndefined();
  });
});
