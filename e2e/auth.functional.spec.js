const { test, expect } = require('@playwright/test');
const {
  collectBrowserIssues,
  expectNoBrowserIssues,
  expectNoHorizontalOverflow,
  expectToast,
  loginAs,
  logout
} = require('./support/rungis-fixtures');

test.describe('authentication and workspace entry', () => {
  test('redirects anonymous users to login for protected workspaces', async ({ page }) => {
    const issues = collectBrowserIssues(page);

    for (const path of ['/dashboard', '/order', '/stocks', '/admin', '/statistics']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
    }

    expectNoBrowserIssues(issues);
  });

  test('shows a clear error for invalid credentials without leaving login', async ({ page }) => {
    const issues = collectBrowserIssues(page);

    await page.goto('/login');
    await page.getByLabel('Username').fill('not-a-real-rungis-user');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: /^sign in$/i }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expectToast(page, 'Invalid credentials.');
    await expectNoHorizontalOverflow(page);
    expectNoBrowserIssues(issues);
  });

  test('logs in and logs out as a client', async ({ page }) => {
    const issues = collectBrowserIssues(page);

    await loginAs(page, 'client');
    await expect(page.getByText('Client Organisation 1')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open order page' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Find vendors' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await logout(page);

    expectNoBrowserIssues(issues);
  });

  test('logs in and logs out as a vendor', async ({ page }) => {
    const issues = collectBrowserIssues(page);

    await loginAs(page, 'vendor');
    await expect(page.getByRole('link', { name: 'Open stocks page' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open statistics' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Client messages' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await logout(page);

    expectNoBrowserIssues(issues);
  });

  test('logs in and logs out as an administrator', async ({ page }) => {
    const issues = collectBrowserIssues(page);

    await loginAs(page, 'admin');
    await expect(page.getByRole('heading', { name: 'Manual daily bill generation' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Client and vendor associations' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await logout(page);

    expectNoBrowserIssues(issues);
  });
});
