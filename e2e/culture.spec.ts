/**
 * Culture lifecycle E2E for Sub-Phase 4.8 — SSR, Hydration & End-to-End
 * Validation.
 *
 * Backend reality: no live API runs in this environment, so the two
 * session-restore transports are fulfilled with contract-exact payloads
 * (same `ApiResponse` envelopes and session shapes as
 * `storefront-auth.spec.ts`). What runs for real: SSR rendering, hydration,
 * `CultureService` initialization/switching/persistence, root `dir`
 * application, and the interceptor pipeline including `Accept-Language`
 * propagation. Error-code localization and date/number/currency formatting
 * have no rendering surface yet (no business UI); they are covered at
 * unit/integration level and arrive on screen with their owning features.
 */

import { expect, test, type Page, type Route } from '@playwright/test';

const CULTURE_KEY = 'fluxcommerce.culture.v1';
const SESSION_KEY = 'fluxcommerce.auth.session.v1';

const TOKEN_PAIR = {
  userId: '11111111-1111-1111-1111-111111111111',
  email: 'ada@flux.local',
  roles: ['Customer'],
  accessToken: 'e2e-access-1',
  refreshToken: 'e2e-refresh-2',
  refreshTokenExpiresAtUtc: '2026-09-13T12:00:00Z',
};

const USER = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'ada@flux.local',
  firstName: 'Ada',
  lastName: 'Lovelace',
  displayName: 'Ada Lovelace',
  roles: ['Customer'],
  isEmailVerified: true,
};

const SESSION_SEED = {
  refreshToken: 'e2e-refresh-1',
  user: { ...USER, displayName: null },
  authenticatedAtUtc: '2026-09-06T12:00:00.000Z',
};

function ok(data: unknown): string {
  return JSON.stringify({ isSuccess: true, message: 'Operation completed successfully.', data });
}

async function directionOf(page: Page): Promise<string | null> {
  return page.evaluate(() => document.documentElement.getAttribute('dir'));
}

async function storedCulture(page: Page): Promise<string | null> {
  return page.evaluate((key) => window.localStorage.getItem(key), CULTURE_KEY);
}

async function seedCulture(page: Page, culture: string): Promise<void> {
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, value),
    [CULTURE_KEY, culture],
  );
}

/** Home shell heading exists in both apps (`Storefront` / `Admin`, including localized admin chrome). */
async function gotoShell(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Storefront|Admin|الإدارة/ })).toBeVisible();
}

test.describe('culture lifecycle (Sub-Phase 4.8)', () => {
  test('SSR renders without a stamped direction (server neutrality)', async ({
    browser,
  }, testInfo) => {
    test.skip(
      testInfo.project.name.includes('admin'),
      'admin is CSR-only: it renders no HTML without JavaScript',
    );
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    try {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: /Storefront|Admin/ })).toBeVisible();
      expect(await directionOf(page)).toBeNull();
    } finally {
      await context.close();
    }
  });

  test('hydration applies the persisted culture direction', async ({ page }) => {
    await page.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [CULTURE_KEY, 'ar'],
    );
    await gotoShell(page);

    await expect.poll(() => directionOf(page)).toBe('rtl');
  });

  test('hydration defaults to LTR without a persisted culture', async ({ page }) => {
    await gotoShell(page);

    await expect.poll(() => directionOf(page)).toBe('ltr');
    expect(await storedCulture(page)).toBeNull();
  });

  test('English → Arabic → RTL → reload → persistence → English → LTR', async ({ page }) => {
    await gotoShell(page);
    await expect.poll(() => directionOf(page)).toBe('ltr');

    await seedCulture(page, 'ar');
    await page.reload();
    await expect.poll(() => directionOf(page)).toBe('rtl');

    await page.reload();
    await expect.poll(() => directionOf(page)).toBe('rtl');
    expect(await storedCulture(page)).toBe('ar');

    await seedCulture(page, 'en');
    await page.reload();
    await expect.poll(() => directionOf(page)).toBe('ltr');
    expect(await storedCulture(page)).toBe('en');
  });

  test('startup API requests carry the active culture and follow switches', async ({ page }) => {
    const refreshLanguages: (string | null)[] = [];
    await page.route('**/auth/refresh', async (route: Route) => {
      refreshLanguages.push(await route.request().headerValue('accept-language'));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: ok(TOKEN_PAIR),
      });
    });
    await page.route('**/auth/me', (route: Route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: ok(USER) }),
    );
    // Seed after the anonymous first load: addInitScript would re-seed on
    // every reload and mask later switches, so seed explicitly per cycle.
    await gotoShell(page);
    await page.evaluate(
      ({ cultureKey, culture, sessionKey, session }) => {
        window.localStorage.setItem(cultureKey, culture);
        window.localStorage.setItem(sessionKey, JSON.stringify(session));
      },
      { cultureKey: CULTURE_KEY, culture: 'ar', sessionKey: SESSION_KEY, session: SESSION_SEED },
    );
    const firstRefresh = page.waitForResponse('**/auth/refresh');
    await page.reload();

    expect((await firstRefresh).status()).toBe(200);
    expect(refreshLanguages).toEqual(['ar']);
    await expect.poll(() => directionOf(page)).toBe('rtl');

    await seedCulture(page, 'de');
    const refreshAfterSwitch = page.waitForResponse('**/auth/refresh');
    await page.reload();
    await refreshAfterSwitch;
    expect(refreshLanguages).toEqual(['ar', 'de']);
  });
});
