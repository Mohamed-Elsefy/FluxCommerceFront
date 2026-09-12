import { defineConfig, devices } from '@playwright/test';

const storefrontBaseURL = 'http://localhost:4200';
const adminBaseURL = 'http://localhost:4201';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: { trace: 'on-first-retry' },
  webServer: [
    {
      command: 'npx ng serve storefront --port 4200',
      url: storefrontBaseURL,
      reuseExistingServer: !process.env['CI'],
      timeout: 180 * 1000,
    },
    {
      command: 'npx ng serve admin --port 4201',
      url: adminBaseURL,
      reuseExistingServer: !process.env['CI'],
      timeout: 180 * 1000,
    },
  ],
  projects: [
    {
      name: 'storefront-chromium',
      testMatch: /storefront\.spec\.ts/,
      use: { baseURL: storefrontBaseURL, ...devices['Desktop Chrome'] },
    },
    {
      name: 'storefront-firefox',
      testMatch: /storefront\.spec\.ts/,
      use: { baseURL: storefrontBaseURL, ...devices['Desktop Firefox'] },
    },
    {
      name: 'storefront-webkit',
      testMatch: /storefront\.spec\.ts/,
      use: { baseURL: storefrontBaseURL, ...devices['Desktop Safari'] },
    },
    {
      name: 'storefront-auth-chromium',
      testMatch: /storefront-auth\.spec\.ts/,
      use: { baseURL: storefrontBaseURL, ...devices['Desktop Chrome'] },
    },
    {
      name: 'admin-chromium',
      testMatch: /admin\.spec\.ts/,
      use: { baseURL: adminBaseURL, ...devices['Desktop Chrome'] },
    },
    {
      name: 'admin-firefox',
      testMatch: /admin\.spec\.ts/,
      use: { baseURL: adminBaseURL, ...devices['Desktop Firefox'] },
    },
    {
      name: 'admin-webkit',
      testMatch: /admin\.spec\.ts/,
      use: { baseURL: adminBaseURL, ...devices['Desktop Safari'] },
    },
    {
      name: 'admin-auth-chromium',
      testMatch: /admin-auth\.spec\.ts/,
      use: { baseURL: adminBaseURL, ...devices['Desktop Chrome'] },
    },
    {
      name: 'catalog-chromium',
      testMatch: /catalog\.spec\.ts/,
      use: { baseURL: storefrontBaseURL, ...devices['Desktop Chrome'] },
    },
    {
      name: 'culture-storefront-chromium',
      testMatch: /culture\.spec\.ts/,
      use: { baseURL: storefrontBaseURL, ...devices['Desktop Chrome'] },
    },
    {
      name: 'culture-admin-chromium',
      testMatch: /culture\.spec\.ts/,
      use: { baseURL: adminBaseURL, ...devices['Desktop Chrome'] },
    },
  ],
});
