const { expect } = require('@playwright/test');

const accounts = {
  client: { username: 'client1', password: '11Test00!!', role: 'client' },
  vendor: { username: 'vendor1', password: '11Test00!!', role: 'vendor' },
  admin: { username: 'ladparis', password: '11Test00!!', role: 'admin' }
};

async function loginAs(page, role) {
  const account = accounts[role];
  if (!account) {
    throw new Error(`Unknown account role: ${role}`);
  }

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /rungis/i })).toBeVisible();
  await page.getByLabel('Username').fill(account.username);
  await page.getByLabel('Password').fill(account.password);
  const landingPath = role === 'admin' ? /\/admin$/ : /\/dashboard$/;
  await Promise.all([
    page.waitForURL(landingPath),
    page.getByRole('button', { name: /^sign in$/i }).click()
  ]);
  await expect(page.getByRole('button', { name: /log out|quitter/i })).toBeAttached();
  await expectWsLive(page);
}

async function logout(page) {
  await Promise.all([
    page.waitForURL(/\/login$/),
    page.getByRole('button', { name: /log out|quitter/i }).click({ force: true })
  ]);
  await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
}

async function expectWsLive(page) {
  await expect(page.locator('.app-header__status')).toContainText(/Live|Offline/, { timeout: 10_000 });
  await expect(page.locator('.toast.text-bg-danger', { hasText: 'Live updates are disconnected.' })).toHaveCount(0);
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth
  }));

  expect(Math.max(overflow.scrollWidth, overflow.bodyScrollWidth)).toBeLessThanOrEqual(overflow.width + 2);
}

async function expectToast(page, text) {
  await expect(page.locator('.toast', { hasText: text })).toBeVisible();
}

async function expectOnlyDanger(page, text) {
  await expect(page.locator('.alert-danger', { hasText: text })).toBeVisible();
}

function collectBrowserIssues(page) {
  const issues = [];
  page.on('console', (message) => {
    const text = message.text();
    const isBrowserResourceNoise = /Failed to load resource: the server responded with a status of 4\d\d/.test(text);
    if (message.type() === 'error' && !isBrowserResourceNoise) {
      issues.push(`console error: ${text}`);
    }
  });
  page.on('pageerror', (error) => {
    issues.push(`page error: ${error.message}`);
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    const url = request.url();
    if (!url.includes('/ws') && !url.includes('favicon')) {
      issues.push(`request failed: ${request.method()} ${url} ${failure?.errorText ?? ''}`.trim());
    }
  });
  page.on('response', (response) => {
    const url = response.url();
    if (response.status() >= 500 && !url.includes('/ws')) {
      issues.push(`server error: ${response.status()} ${url}`);
    }
  });
  return issues;
}

function expectNoBrowserIssues(issues) {
  expect(issues, issues.join('\n')).toEqual([]);
}

module.exports = {
  accounts,
  collectBrowserIssues,
  expectNoBrowserIssues,
  expectNoHorizontalOverflow,
  expectOnlyDanger,
  expectToast,
  expectWsLive,
  loginAs,
  logout
};
