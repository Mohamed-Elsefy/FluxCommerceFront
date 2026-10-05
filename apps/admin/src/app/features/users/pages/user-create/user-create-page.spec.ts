import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiError, IdentityApiService, provideApi, provideAppEnvironment } from '@flux/api';
import { CultureService } from '@flux/i18n';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { UserCreatePage } from './user-create-page';

const USER_ID = '22222222-2222-2222-2222-222222222222';

function createdUser() {
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
    permissions: [],
  };
}

function setup(
  scenario: {
    registerAdmin?: (body: unknown) => ReturnType<typeof of>;
  } = {},
): {
  registerAdmin: ReturnType<typeof vi.fn>;
} {
  const registerAdmin = vi.fn(
    (body: unknown) =>
      scenario.registerAdmin?.(body) ??
      of({ isSuccess: true, message: 'Created.', data: createdUser() }),
  );
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
      { provide: IdentityApiService, useValue: { registerAdmin } },
    ],
  });
  window.localStorage.clear();
  return { registerAdmin };
}

function render(): {
  fixture: ReturnType<typeof TestBed.createComponent<UserCreatePage>>;
  element: HTMLElement;
} {
  const fixture = TestBed.createComponent(UserCreatePage);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function fill(element: HTMLElement, id: string, value: string): void {
  const input = element.querySelector(`#${id}`) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('change'));
}

function submit(element: HTMLElement): void {
  element
    .querySelector('.user-create-page-form')
    ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('UserCreatePage', () => {
  it('renders the creation form without a result', () => {
    setup({});
    const { element } = render();

    expect(element.querySelector('h1')?.textContent).toBe('Create admin');
    expect(element.querySelector('#user-create-email')).not.toBeNull();
    expect(element.querySelector('#user-create-password')).not.toBeNull();
    expect(element.querySelector('#user-create-first-name')).not.toBeNull();
    expect(element.querySelector('#user-create-last-name')).not.toBeNull();
    expect(element.querySelector('.user-create-page-facts')).toBeNull();
    expect(element.querySelector('.user-create-page-back')?.getAttribute('href')).toBe(
      '/users/list',
    );
  });

  it('blocks invalid submits without traffic', () => {
    const { registerAdmin } = setup({});
    const { element } = render();

    fill(element, 'user-create-email', 'not-an-email');
    fill(element, 'user-create-password', 'short');
    submit(element);

    expect(registerAdmin).not.toHaveBeenCalled();
    expect(element.querySelector('.user-create-page-facts')).toBeNull();
  });

  it('creates the admin and renders the backend-returned record with a details link', () => {
    const { registerAdmin } = setup({});
    const { fixture, element } = render();

    fill(element, 'user-create-email', 'boss@flux.local');
    fill(element, 'user-create-password', 'Test123!');
    fill(element, 'user-create-first-name', 'Boss');
    fill(element, 'user-create-last-name', 'Admin');
    submit(element);
    fixture.detectChanges();

    expect(registerAdmin).toHaveBeenCalledWith({
      email: 'boss@flux.local',
      password: 'Test123!',
      firstName: 'Boss',
      lastName: 'Admin',
    });
    const facts = element.querySelector('.user-create-page-facts')?.textContent ?? '';
    expect(facts).toContain('boss@flux.local');
    expect(element.querySelector('.user-create-page-view-user')?.getAttribute('href')).toBe(
      `/users/${USER_ID}`,
    );
    const notifications = TestBed.inject(AdminNotificationService).notifications();
    expect(notifications.at(-1)?.type).toBe('success');
    expect(notifications.at(-1)?.title).toBe('Admin created');
    expect(notifications.at(-1)?.message).toContain('with no permissions');
  });

  it('renders duplicate emails as the form-level notice with input preserved', () => {
    const { registerAdmin } = setup({
      registerAdmin: () => throwError(() => new ApiError({ status: 409, message: 'Conflict.' })),
    });
    const { fixture, element } = render();

    fill(element, 'user-create-email', 'boss@flux.local');
    fill(element, 'user-create-password', 'Test123!');
    fill(element, 'user-create-first-name', 'Boss');
    fill(element, 'user-create-last-name', 'Admin');
    submit(element);
    fixture.detectChanges();

    expect(registerAdmin).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.user-create-page-facts')).toBeNull();
    expect((element.querySelector('#user-create-email') as HTMLInputElement).value).toBe(
      'boss@flux.local',
    );
  });

  it('localizes the creation page for the active culture', () => {
    setup({});
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('fr');
    try {
      const { element } = render();

      expect(element.querySelector('h1')?.textContent).toBe('Créer un admin');
    } finally {
      cultures.setCulture('en');
    }
  });

  it('renders the creation page under the RTL culture without key leakage', () => {
    setup({});
    const cultures = TestBed.inject(CultureService);
    cultures.setCulture('ar');
    try {
      const { element } = render();

      expect(element.querySelector('h1')?.textContent).toBe('إنشاء مشرف');
      expect(element.textContent).not.toContain('users.create.heading');
    } finally {
      cultures.setCulture('en');
    }
  });
});
