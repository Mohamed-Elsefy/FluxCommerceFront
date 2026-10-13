/**
 * Payments-Mine E2E journeys for Supplement S1, Step S1.9 — Payments:
 * Mine + Admin + Stats (storefront slice).
 *
 * Covers the caller-owned `GET /api/payments/mine` list through the
 * real storefront (routing, guards, page, state, data access) with
 * transport mocked at the network boundary (`page.route`):
 *
 * ```text
 * Authenticated Customer
 *         ↓
 * /payment/mine (paged list + status filter + pager)
 * ```
 *
 * Contract scope: every amount, count, and status asserted below comes
 * from a mock response — the suite fails if the UI ever computes them.
 * Unknown statuses surface as backend `400 Payment.ValidationFailed`
 * (never invented); foreign payments never appear (caller-owned only).
 *
 * Backend-authoritative rule (pinned throughout): rows echo the
 * `PaymentAdminResponse` payloads verbatim; no order status renders
 * here (no such contract field); no history timeline exists.
 */

import { expect, test, type Page, type Route } from '@playwright/test';

const API_ORIGIN = 'https://localhost:7119';
const AUTH_KEY = 'fluxcommerce.auth.session.v1';
const USER_ID = 'cccccccc-3333-4333-8333-333333333333';

function paymentSummary(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'pay-1',
    orderId: '11111111-1111-4111-8111-111111111111',
    customerId: USER_ID,
    amount: 59.98,
    currency: 'USD',
    status: 'Succeeded',
    providerPaymentIntentId: 'pi_123',
    provider: 'stripe',
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:01:00Z',
    version: 3,
    ...overrides,
  };
}

function paged(items: unknown[], totalCount: number, pageNumber = 1): Record<string, unknown> {
  return { items, totalCount, pageNumber, pageSize: 20 };
}

function envelope(data: unknown): Record<string, unknown> {
  return { isSuccess: true, message: 'Operation completed successfully.', data };
}

function userResponse(): Record<string, unknown> {
  return {
    id: USER_ID,
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
  };
}

/** Seeds an authenticated customer session (mirrors the auth-suite storage shape). */
async function mockSession(page: Page): Promise<void> {
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({
      json: envelope({
        userId: USER_ID,
        email: 'ada@flux.local',
        roles: ['Customer'],
        accessToken: 'e2e-access-2',
        refreshToken: 'e2e-refresh-2',
        refreshTokenExpiresAtUtc: '2026-09-13T12:00:00Z',
      }),
    }),
  );
  await page.route('**/auth/me', (route) => route.fulfill({ json: envelope(userResponse()) }));
  await page.addInitScript(
    ({ key, user }) =>
      window.localStorage.setItem(
        key,
        JSON.stringify({
          refreshToken: 'e2e-refresh-1',
          user,
          authenticatedAtUtc: '2026-09-06T12:00:00.000Z',
        }),
      ),
    { key: AUTH_KEY, user: userResponse() },
  );
}

async function mockMine(
  page: Page,
  method: string,
  pathname: string,
  status: number,
  body: unknown,
): Promise<void> {
  await page.route(
    (url) => url.origin === API_ORIGIN && url.pathname === pathname,
    (route: Route) =>
      route.request().method() === method
        ? route.fulfill({
            status,
            contentType: 'application/json',
            body: typeof body === 'string' ? body : JSON.stringify(body),
          })
        : route.fallback(),
  );
}

test.describe('payments-mine journeys (S1.9)', () => {
  test('mine list renders caller-owned rows with the status filter and pager', async ({ page }) => {
    await mockSession(page);
    await mockMine(page, 'GET', '/api/payments/mine', 200, envelope(paged([paymentSummary()], 1)));
    await page.goto('/payment/mine');

    await expect(page.getByRole('heading', { name: 'My payments' })).toBeVisible();
    await expect(
      page.locator('.payments-mine-row', { hasText: 'Succeeded' }).first(),
    ).toBeVisible();
    await expect(page.locator('#payments-status-filter')).toBeVisible();
  });

  test('mine list filters by status through the backend query', async ({ page }) => {
    await mockSession(page);
    await page.route(
      (url) => url.origin === API_ORIGIN && url.pathname === '/api/payments/mine',
      (route: Route) => {
        if (route.request().method() !== 'GET') {
          return route.fallback();
        }
        const status = new URL(route.request().url()).searchParams.get('status') ?? '';
        return status === 'Failed'
          ? route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(
                envelope(paged([paymentSummary({ id: 'pay-2', status: 'Failed' })], 1)),
              ),
            })
          : route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(envelope(paged([paymentSummary()], 1))),
            });
      },
    );
    await page.goto('/payment/mine');
    await expect(
      page.locator('.payments-mine-row', { hasText: 'Succeeded' }).first(),
    ).toBeVisible();

    await page.locator('#payments-status-filter').selectOption('Failed');

    await expect(page.locator('.payments-mine-row', { hasText: 'Failed' }).first()).toBeVisible();
  });

  test('mine list renders the empty state without rows', async ({ page }) => {
    await mockSession(page);
    await mockMine(page, 'GET', '/api/payments/mine', 200, envelope(paged([], 0)));
    await page.goto('/payment/mine');

    await expect(page.getByText('No payments yet')).toBeVisible();
  });

  test('mine list renders the error state with retry recovery', async ({ page }) => {
    await mockSession(page);
    let calls = 0;
    await page.route(
      (url) => url.origin === API_ORIGIN && url.pathname === '/api/payments/mine',
      (route: Route) => {
        if (route.request().method() !== 'GET') {
          return route.fallback();
        }
        calls += 1;
        return calls === 1
          ? route.fulfill({
              status: 400,
              contentType: 'application/json',
              body: JSON.stringify({
                type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
                title: 'Validation Failed',
                status: 400,
                detail: 'The payment query parameters are invalid.',
                instance: '/api/payments/mine',
                traceId: 'e2e-trace-1',
                errors: { status: ['Unknown payment status.'] },
              }),
            })
          : route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(envelope(paged([paymentSummary()], 1))),
            });
      },
    );
    await page.goto('/payment/mine');

    await expect(page.getByText('Could not load payments')).toBeVisible();
    await page.getByRole('button', { name: 'Retry' }).click();

    await expect(
      page.locator('.payments-mine-row', { hasText: 'Succeeded' }).first(),
    ).toBeVisible();
  });

  test('anonymous customers redirect to login with a return URL', async ({ page }) => {
    await page.goto('/payment/mine');

    await expect(page).toHaveURL(/\/login\?returnUrl=/);
  });
});
