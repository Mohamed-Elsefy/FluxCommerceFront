import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  emptyResource,
  errorResource,
  loadingResource,
  provideApi,
  provideAppEnvironment,
  successResource,
  type ResourceState,
} from '@flux/api';
import { CultureService } from '@flux/i18n';
import type { UserAdminResponse } from '@flux/models';
import { UsersListState } from '../../state/users-list-state';
import type { UserAdminPage } from '../../models/users-admin.models';
import { UsersListPage } from './users-list-page';

function row(id: string, overrides: Partial<UserAdminResponse> = {}): UserAdminResponse {
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
    ...overrides,
  };
}

function pageState(items: UserAdminResponse[]): ResourceState<UserAdminPage> {
  return successResource({
    items,
    totalCount: items.length,
    pageNumber: 1,
    pageSize: 20,
  });
}

function setup(scenario: { page?: ResourceState<UserAdminPage> }): {
  load: ReturnType<typeof vi.fn>;
  setPage: ReturnType<typeof vi.fn>;
  setFilters: ReturnType<typeof vi.fn>;
  reload: ReturnType<typeof vi.fn>;
} {
  const load = vi.fn();
  const setPage = vi.fn();
  const setFilters = vi.fn();
  const reload = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideAppEnvironment({
        name: 'development',
        production: false,
        appName: 'test',
        apiBaseUrl: '/api',
      }),
      provideApi(),
      provideHttpClientTesting(),
      provideRouter([]),
      {
        provide: UsersListState,
        useValue: {
          page: signal(scenario.page ?? loadingResource<UserAdminPage>()),
          load,
          setPage,
          setFilters,
          reload,
        },
      },
    ],
  });
  window.localStorage.clear();
  return { load, setPage, setFilters, reload };
}

function render(): HTMLElement {
  const fixture = TestBed.createComponent(UsersListPage);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('UsersListPage', () => {
  it('loads the first page on init and renders rows with deep links', () => {
    const { load } = setup({ page: pageState([row('user-1'), row('user-2')]) });
    const element = render();

    expect(load).toHaveBeenCalledTimes(1);
    expect(element.querySelector('h1')?.textContent).toBe('Users list');
    const links = [...element.querySelectorAll('admin-data-table a')].map((node) =>
      node.getAttribute('href'),
    );
    expect(links).toContain('/users/user-1');
    expect(links).toContain('/users/user-2');
    expect(element.textContent).toContain('user-1@flux.local');
  });

  it('links to admin creation from the list header', () => {
    setup({ page: pageState([row('user-1')]) });
    const element = render();

    expect(element.querySelector('.users-list-new')?.getAttribute('href')).toBe('/users/new');
  });

  it('renders the status badge per row', () => {
    setup({ page: pageState([row('user-1', { status: 3 })]) });
    const element = render();

    expect(element.querySelector('app-user-status-badge')).not.toBeNull();
  });

  it('commits filters on apply', () => {
    const { setFilters } = setup({ page: pageState([]) });
    const element = render();

    const form = element.querySelector('.users-list-filters') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));

    expect(setFilters).toHaveBeenCalledTimes(1);
  });

  it('clears filters through the filter bar', () => {
    const { setFilters } = setup({ page: pageState([]) });
    const element = render();

    const clear = element.querySelector('.filter-bar-clear') as HTMLButtonElement;
    expect(clear).not.toBeNull();
    clear.click();

    expect(setFilters).toHaveBeenCalledWith({});
  });

  it('commits pager moves through the state', () => {
    const { setPage } = setup({
      page: successResource<UserAdminPage>({
        items: [row('user-1')],
        totalCount: 25,
        pageNumber: 1,
        pageSize: 20,
      }),
    });
    const element = render();

    const next = [...element.querySelectorAll('admin-pagination button')].find(
      (button) => button.textContent?.trim() === 'Next',
    ) as HTMLButtonElement;
    next.click();

    expect(setPage).toHaveBeenCalledWith(2);
  });

  it('renders the empty state for out-of-range pages', () => {
    setup({ page: emptyResource<UserAdminPage>() });
    const element = render();

    expect(element.querySelector('admin-data-table')).not.toBeNull();
    expect(element.textContent).toContain('No users found');
  });

  it('renders the error state with retry', () => {
    const { reload } = setup({
      page: errorResource<UserAdminPage>(new ApiError({ status: 403, message: 'Forbidden.' })),
    });
    const element = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    const retry = element.querySelector('flux-error-state button') as HTMLButtonElement;
    retry.click();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('localizes the list for the active culture', () => {
    setup({ page: pageState([row('user-1')]) });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      const element = render();

      expect(element.querySelector('h1')?.textContent).toBe('Liste des utilisateurs');
    } finally {
      cultures.setCulture('en');
    }
  });

  it('renders the list under the RTL culture without key leakage', () => {
    setup({ page: pageState([row('user-1')]) });
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('ar');
    try {
      const element = render();

      expect(element.querySelector('h1')?.textContent).toBe('قائمة المستخدمين');
      expect(element.textContent).not.toContain('users.list.heading');
      expect(element.querySelector('admin-pagination')).not.toBeNull();
    } finally {
      cultures.setCulture('en');
    }
  });
});
