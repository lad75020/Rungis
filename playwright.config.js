const { defineConfig, devices } = require('@playwright/test');

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3199';
const appUrl = new URL(baseURL);
const host = appUrl.hostname;
const port = appUrl.port || '3199';

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 45_000,
  expect: {
    timeout: 8_000
  },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL,
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  webServer: {
    command: `npm run build && HOST=${host} PORT=${port} E2E_DISABLE_PAGE_RATE_LIMIT=1 SESSION_SECRET=rungis-functional-session-secret-32-chars-minimum JWT_SECRET=rungis-functional-jwt-secret-32-chars-minimum npm start`,
    url: `${baseURL}/health`,
    timeout: 120_000,
    reuseExistingServer: true
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width: 1440, height: 1000 }
      }
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        channel: 'chrome'
      }
    }
  ]
});
