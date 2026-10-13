import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import {
  ApiError,
  errorResource,
  loadingResource,
  provideApi,
  provideAppEnvironment,
  successResource,
  type ResourceState,
} from '@flux/api';
import { CultureService } from '@flux/i18n';
import { AuthService } from '@flux/auth';
import type { UserAdminResponse } from '@flux/models';
import { IdentityApiService } from '@flux/api';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { UserDetailsState } from '../../state/user-details-state';
import { UserDetailsPage } from './user-details-page';

const USER_ID = '22222222-2222-2222-2222-222222222222';

function record(): UserAdminResponse {
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

function setup(scenario: {
  details?: ResourceState<UserAdminResponse>;
  permissions?: ResourceState<readonly string[]>;
  catalog?: ResourceState<readonly string[]>;
  viewerRoles?: readonly string[];
  viewerPermissions?: readonly string[];
}): {
  load: ReturnType<typeof vi.fn>;
  loadCatalog: ReturnType<typeof vi.fn>;
  reload: ReturnType<typeof vi.fn>;
  grantPermission: ReturnType<typeof vi.fn>;
  revokePermission: ReturnType<typeof vi.fn>;
} {
  const load = vi.fn();
  const loadCatalog = vi.fn();
  const reload = vi.fn();
  const grantPermission = vi.fn(() => of(envelope(record())));
  const revokePermission = vi.fn(() => of(envelope(record())));
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
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({ id: USER_ID })) },
      },
      {
        provide: UserDetailsState,
        useValue: {
          details: signal(scenario.details ?? successResource(record())),
          permissions: signal(scenario.permissions ?? successResource(['orders.read'])),
          catalog: signal(scenario.catalog ?? successResource(['orders.read', 'catalog.manage'])),
          load,
          loadCatalog,
          reload,
        },
      },
      {
        provide: IdentityApiService,
        useValue: { grantPermission, revokePermission },
      },
    ],
  });
  window.localStorage.clear();
  TestBed.inject(AuthService).setAuthenticated({
    user: {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'viewer@flux.local',
      displayName: 'Viewer Admin',
      roles: [...(scenario.viewerRoles ?? ['SuperAdmin'])],
      permissions: [...(scenario.viewerPermissions ?? [])],
      isEmailVerified: true,
      avatarUrl: null,
    },
    accessToken: 'test-access-token',
  });
  return { load, loadCatalog, reload, grantPermission, revokePermission };
}

function render(): { fixture: ComponentFixture<UserDetailsPage>; element: HTMLElement } {
  const fixture = TestBed.createComponent(UserDetailsPage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('UserDetailsPage', () => {
  it('loads the user on init and renders facts with the status badge', () => {
    const { load, loadCatalog } = setup({});
    const { element } = render();

    expect(load).toHaveBeenCalledWith(USER_ID);
    expect(loadCatalog).toHaveBeenCalledTimes(1);
    expect(element.querySelector('h1')?.textContent).toBe('User facts');
    expect(element.textContent).toContain('boss@flux.local');
    expect(element.querySelector('app-user-status-badge')).not.toBeNull();
    expect(element.querySelector('a.user-details-back')?.getAttribute('href')).toBe('/users/list');
  });

  it('renders granted permissions with revoke actions', () => {
    setup({});
    const { element } = render();

    expect(element.querySelector('h2')?.textContent).toBe('Granted permissions');
    expect(element.textContent).toContain('orders.read');
    expect(element.querySelector('.user-permission-revoke')).not.toBeNull();
  });

  it('renders the empty permissions state', () => {
    setup({ permissions: successResource([]) });
    const { element } = render();

    expect(element.textContent).toContain('No permissions granted.');
  });

  it('renders the details error state with retry', () => {
    const { reload } = setup({
      details: errorResource<UserAdminResponse>(
        new ApiError({ status: 404, message: 'Not found.' }),
      ),
    });
    const { element } = render();

    expect(element.querySelector('flux-error-state')).not.toBeNull();
    expect(element.textContent).toContain('User unavailable');
    const retry = element.querySelector('flux-error-state button') as HTMLButtonElement;
    retry.click();

    expect(reload).toHaveBeenCalledWith(USER_ID);
  });

  it('grants the picked permission with a success toast and reload', () => {
    const { grantPermission, load } = setup({});
    const { element } = render();

    const form = element.querySelector('.user-grant-form') as HTMLFormElement;
    const select = element.querySelector('#user-grant-permission') as HTMLSelectElement;
    select.value = 'catalog.manage';
    select.dispatchEvent(new Event('change'));
    form.dispatchEvent(new Event('submit'));

    expect(grantPermission).toHaveBeenCalledWith(USER_ID, { permission: 'catalog.manage' });
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith(USER_ID);
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.title).toBe('Permission granted');
  });

  it('revokes behind the confirm dialog with a success toast and reload', () => {
    const { revokePermission, load } = setup({});
    const { fixture, element } = render();

    (element.querySelector('.user-permission-revoke') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(element.querySelector('admin-dialog')).not.toBeNull();
    expect(element.textContent).toContain('Revoke orders.read from boss@flux.local?');

    const confirm = element.querySelector('.user-details-dialog-confirm') as HTMLButtonElement;
    confirm.click();

    expect(revokePermission).toHaveBeenCalledWith(USER_ID, 'orders.read');
    expect(load).toHaveBeenCalledTimes(2);
    expect(load).toHaveBeenLastCalledWith(USER_ID);
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.title).toBe('Permission revoked');
  });

  it('localizes the details for the active culture', () => {
    setup({});
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      const { element } = render();

      expect(element.querySelector('h1')?.textContent).toBe('Informations');
    } finally {
      cultures.setCulture('en');
    }
  });

  it('renders the details under the RTL culture without key leakage', () => {
    setup({});
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('ar');
    try {
      const { element } = render();

      expect(element.querySelector('h1')?.textContent).toBe('بيانات المستخدم');
      expect(element.textContent).not.toContain('users.details.factsTitle');
    } finally {
      cultures.setCulture('en');
    }
  });

  it('surfaces grant conflicts through an error toast without reload', () => {
    const failure = new ApiError({ status: 409, message: 'Already granted.' });
    const { grantPermission, load } = setup({});
    vi.mocked(grantPermission).mockReturnValue(throwError(() => failure));
    const { element } = render();

    const form = element.querySelector('.user-grant-form') as HTMLFormElement;
    const select = element.querySelector('#user-grant-permission') as HTMLSelectElement;
    select.value = 'catalog.manage';
    select.dispatchEvent(new Event('change'));
    form.dispatchEvent(new Event('submit'));

    expect(grantPermission).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.title).toBe('Request failed');
  });

  it('hides grant and revoke affordances from users.read viewers', () => {
    setup({ viewerRoles: ['Admin'], viewerPermissions: ['users.read'] });
    const { element } = render();

    expect(element.textContent).toContain('orders.read');
    expect(element.querySelector('.user-grant-form')).toBeNull();
    expect(element.querySelector('.user-permission-revoke')).toBeNull();
  });

  it('surfaces denials (plain 403) as error toasts without reload', () => {
    const failure = new ApiError({ status: 403, message: 'Forbidden.' });
    const { grantPermission, load } = setup({});
    vi.mocked(grantPermission).mockReturnValue(throwError(() => failure));
    const { element } = render();

    const form = element.querySelector('.user-grant-form') as HTMLFormElement;
    const select = element.querySelector('#user-grant-permission') as HTMLSelectElement;
    select.value = 'catalog.manage';
    select.dispatchEvent(new Event('change'));
    form.dispatchEvent(new Event('submit'));

    expect(grantPermission).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledTimes(1);
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.title).toBe('Request failed');
  });
});
