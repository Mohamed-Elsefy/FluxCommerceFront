/**
 * Storefront authentication lifecycle E2E for Sub-Phase 2.14.
 *
 * Backend reality: no live API runs in this environment, so backend
 * transports are fulfilled with contract-exact payloads
 * (`docs/frontend-contract/*`: `ApiResponse` envelopes, wire casing,
 * opaque refresh rotation). What runs for real: routing, forms,
 * validation, state transitions, session persistence, the interceptor
 * pipeline, and every pixel asserted below. Live-backend runs simply
 * drop the `page.route` fulfillments.
 */

import { expect, test, type Page, type Route } from '@playwright/test';

const STORAGE_KEY = 'fluxcommerce.auth.session.v1';

const PENDING_USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'ada@flux.local',
  roles: ['Customer'],
  isEmailVerified: false,
  registeredAtUtc: '2026-09-06T12:00:00Z',
  firstName: 'Ada',
  lastName: 'Lovelace',
  displayName: 'Ada Lovelace',
  phoneNumber: null,
  isPhoneVerified: false,
  avatarUrl: null,
  preferredLanguage: 'en',
  timeZone: 'UTC',
  status: 0,
};

const ACTIVE_USER = { ...PENDING_USER, isEmailVerified: true, status: 1 };

const TOKEN_PAIR = {
  userId: PENDING_USER.id,
  email: PENDING_USER.email,
  roles: ['Customer'],
  accessToken: 'e2e-access-1',
  refreshToken: 'e2e-refresh-1',
  refreshTokenExpiresAtUtc: '2026-09-13T12:00:00Z',
};

const ROTATED_PAIR = { ...TOKEN_PAIR, accessToken: 'e2e-access-2', refreshToken: 'e2e-refresh-2' };

function ok(data: unknown): string {
  return JSON.stringify({ isSuccess: true, message: 'Operation completed successfully.', data });
}

async function fulfill(route: Route, data: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: status === 200 ? ok(data) : JSON.stringify(data),
  });
}

function problem(status: number, detail: string): Record<string, unknown> {
  return {
    type: 'https://tools.ietf.org/html/rfc7235#section-3.1',
    title: 'Unauthorized',
    status,
    detail,
    extensions: {},
  };
}

/**
 * The dev server renders with SSR + hydration: typing into SSR HTML before
 * the client claims it gets wiped when bindings attach, so navigation waits
 * for the shell to leave its `initializing` placeholder (Login links or the
 * signed-in user — both render only after hydration and restoration settle)
 * before any test touches a form.
 */
async function gotoStable(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(
    page.getByRole('link', { name: 'Login' }).first().or(page.getByText('Ada Lovelace')),
  ).toBeVisible();
}

/**
 * Hydration-safe fill: lazy page chunks can finish claiming their inputs at
 * any moment and reset them to control state, so a value only counts once
 * it survives an undisturbed observation window — wipes get repaired by
 * the next poll iteration instead of racing the submit click.
 */
async function fillField(page: Page, label: string, value: string, exact = false): Promise<void> {
  const field = page.getByLabel(label, { exact });
  await expect
    .poll(
      async () => {
        if ((await field.inputValue()) !== value) {
          await field.fill(value);
          return 'refilling';
        }
        await page.waitForTimeout(750);
        return field.inputValue();
      },
      { timeout: 20000 },
    )
    .toBe(value);
}

async function mockLogin(page: Page, user: typeof ACTIVE_USER = ACTIVE_USER): Promise<void> {
  await page.route('**/auth/login', (route) => fulfill(route, TOKEN_PAIR));
  await page.route('**/auth/me', (route) => fulfill(route, user));
}

test.describe('storefront authentication lifecycle', () => {
  test('register shows the pending-verification state without signing in', async ({ page }) => {
    await page.route('**/auth/register', (route) => fulfill(route, PENDING_USER));
    await gotoStable(page, '/register');

    await fillField(page, 'Email', 'ada@flux.local');
    await fillField(page, 'Password', 'Valid123!', true);
    await fillField(page, 'First name', 'Ada');
    await fillField(page, 'Last name', 'Lovelace');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();
    await expect(page.getByText('ada@flux.local')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Login' }).first()).toBeVisible();
  });

  test('login authenticates, persists the session, and honors returnUrl', async ({ page }) => {
    await mockLogin(page);
    await page.route('**/auth/refresh', (route) => fulfill(route, ROTATED_PAIR));
    await gotoStable(page, '/login?returnUrl=/forgot-password');

    await fillField(page, 'Email', 'ada@flux.local');
    await fillField(page, 'Password', 'Valid123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/forgot-password$/);
    await gotoStable(page, '/');
    await expect(page.getByText('Ada Lovelace')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
    expect(stored).toContain('e2e-refresh-2');
    expect(stored).not.toContain('Valid123!');
    expect(stored).not.toContain('e2e-access-1');
  });

  test('reload restores the session through refresh rotation', async ({ page }) => {
    await page.route('**/auth/refresh', (route) => fulfill(route, ROTATED_PAIR));
    await page.route('**/auth/me', (route) => fulfill(route, ACTIVE_USER));
    await page.addInitScript(
      ({ key, session }) => window.localStorage.setItem(key, JSON.stringify(session)),
      {
        key: STORAGE_KEY,
        session: {
          refreshToken: 'e2e-refresh-1',
          user: { ...ACTIVE_USER, displayName: null },
          authenticatedAtUtc: '2026-09-06T12:00:00.000Z',
        },
      },
    );
    await gotoStable(page, '/');

    await expect(page.getByText('Ada Lovelace')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
    expect(stored).toContain('e2e-refresh-2');
  });

  test('failed refresh settles to anonymous', async ({ page }) => {
    await page.route('**/auth/refresh', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/problem+json',
        body: JSON.stringify(problem(401, 'Invalid refresh token.')),
      }),
    );
    await page.addInitScript(
      ({ key, session }) => window.localStorage.setItem(key, JSON.stringify(session)),
      {
        key: STORAGE_KEY,
        session: {
          refreshToken: 'stale-refresh',
          user: { ...ACTIVE_USER, displayName: null },
          authenticatedAtUtc: '2026-09-06T12:00:00.000Z',
        },
      },
    );
    await gotoStable(page, '/');

    await expect(page.getByRole('link', { name: 'Login' }).first()).toBeVisible();
    const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
    expect(stored).toBeNull();
  });

  test('logout revokes, clears, and returns to anonymous', async ({ page }) => {
    const revoked: unknown[] = [];
    await mockLogin(page);
    await page.route('**/auth/logout', async (route) => {
      revoked.push(route.request().postDataJSON());
      await fulfill(route, null);
    });
    await gotoStable(page, '/login');
    await fillField(page, 'Email', 'ada@flux.local');
    await fillField(page, 'Password', 'Valid123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();

    await page.getByRole('button', { name: 'Logout' }).click();

    await expect(page.getByRole('link', { name: 'Login' }).first()).toBeVisible();
    expect(revoked).toEqual([{ refreshToken: 'e2e-refresh-1' }]);
    const stored = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
    expect(stored).toBeNull();
  });

  test('rejected credentials stay on the form with the backend message', async ({ page }) => {
    await page.route('**/auth/login', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/problem+json',
        body: JSON.stringify(problem(401, 'Invalid email or password.')),
      }),
    );
    await gotoStable(page, '/login');

    await fillField(page, 'Email', 'ada@flux.local');
    await fillField(page, 'Password', 'Wrong123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText('Invalid email or password.')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
