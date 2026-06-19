const { test, expect } = require('@playwright/test');
const {
  collectBrowserIssues,
  expectNoBrowserIssues,
  expectNoHorizontalOverflow,
  expectWsLive,
  loginAs
} = require('./support/rungis-fixtures');

test.describe('role-based navigation and authorization', () => {
  test('client can use client pages and is blocked from vendor/admin pages', async ({ page }) => {
    const issues = collectBrowserIssues(page);

    await loginAs(page, 'client');

    await page.goto('/order');
    await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cart' })).toBeVisible();
    await expect(page.locator('#order-category-filter')).toBeVisible();
    await expect(page.locator('#order-vendor-filter')).toBeVisible();
    await expect(page.locator('#order-delivery-date')).toBeVisible();
    await expectWsLive(page);

    await page.goto('/stocks');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('link', { name: 'Open order page' })).toBeVisible();

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.goto('/statistics');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expectNoHorizontalOverflow(page);

    expectNoBrowserIssues(issues);
  });

  test('vendor can use stock pages and is blocked from client/admin pages', async ({ page }) => {
    const issues = collectBrowserIssues(page);

    await loginAs(page, 'vendor');

    await page.goto('/stocks');
    await expect(page.getByRole('heading', { name: /add merchandise|edit merchandise/i })).toBeVisible();
    await expect(page.locator('#stock-name')).toBeVisible();
    await expect(page.locator('#stock-reference')).toBeVisible();
    await expect(page.locator('#stock-price')).toBeVisible();
    await expect(page.locator('#stock-qty')).toBeVisible();
    await expectWsLive(page);

    await page.goto('/order');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('link', { name: 'Open stocks page' })).toBeVisible();

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expectNoHorizontalOverflow(page);

    expectNoBrowserIssues(issues);
  });

  test('administrator can use admin and statistics pages and is blocked from client/vendor-only pages', async ({ page }) => {
    const issues = collectBrowserIssues(page);

    await loginAs(page, 'admin');

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Manual daily bill generation' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Unpaid bill settings' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Application style profile' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Client and vendor associations' })).toBeVisible();
    await expect(page.locator('#assoc-client-select')).toBeVisible();
    await expect(page.locator('#assoc-vendor-select')).toBeVisible();

    await page.goto('/statistics');
    await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Activated orders count' })).toBeVisible();

    await page.goto('/order');
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Manual daily bill generation' })).toBeVisible();

    await page.goto('/stocks');
    await expect(page).toHaveURL(/\/admin$/);
    await expectNoHorizontalOverflow(page);

    expectNoBrowserIssues(issues);
  });
});
