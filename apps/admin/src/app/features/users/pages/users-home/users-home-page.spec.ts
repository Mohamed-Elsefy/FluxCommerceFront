import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { provideApi, provideAppEnvironment, type ResourceStatus } from '@flux/api';
import { ApiError } from '@flux/api';
import { CultureService } from '@flux/i18n';
import type { UserAdminCountsResponse } from '@flux/models';
import { UsersCountsState } from '../../state/users-counts-state';
import { UsersHomePage } from './users-home-page';

function counts(): UserAdminCountsResponse {
  return {
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
  };
}

function setup(scenario: {
  status: ResourceStatus;
  data?: UserAdminCountsResponse | null;
  error?: ApiError | null;
}): { load: ReturnType<typeof vi.fn> } {
  const load = vi.fn();
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
        provide: UsersCountsState,
        useValue: {
          counts: signal({
            status: scenario.status,
            data: scenario.data ?? null,
            error: scenario.error ?? null,
            isLoading: scenario.status === 'loading' || scenario.status === 'idle',
            isSuccess: scenario.status === 'success',
            isEmpty: false,
            isError: scenario.status === 'error',
          }),
          load,
          reload: vi.fn(),
        },
      },
    ],
  });
  window.localStorage.clear();
  return { load };
}

function render(): HTMLElement {
  const fixture = TestBed.createComponent(UsersHomePage);
  TestBed.inject(CultureService).setCulture('en');
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('UsersHomePage', () => {
  it('loads the counts on init and renders every bucket verbatim', () => {
    const { load } = setup({ status: 'success', data: counts() });
    const element = render();

    expect(load).toHaveBeenCalledTimes(1);
    expect(element.querySelector('h1')?.textContent).toBe('Users');
    const facts = [...element.querySelectorAll('.users-home-facts > div')].map(
      (row) =>
        `${row.querySelector('dt')?.textContent?.trim()}: ${row
          .querySelector('dd')
          ?.textContent?.trim()}`,
    );
    expect(facts).toHaveLength(11);
    expect(facts).toContain('Total users: 7');
    expect(facts).toContain('Locked out: 1');
    expect(element.querySelector('a.users-home-list-link')?.getAttribute('href')).toBe(
      '/users/list',
    );
  });

  it('renders the loading state while counts load', () => {
    setup({ status: 'loading' });
    const element = render();

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
    expect(element.querySelector('.users-home-facts')).toBeNull();
  });

  it('renders the error state with retry', () => {
    setup({
      status: 'error',
      error: new ApiError({ status: 403, message: 'Forbidden.' }),
    });
    const element = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    expect(element.textContent).toContain('User counts unavailable');
  });
});
