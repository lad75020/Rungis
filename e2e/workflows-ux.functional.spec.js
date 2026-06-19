const { test, expect } = require('@playwright/test');
const {
  collectBrowserIssues,
  expectNoBrowserIssues,
  expectNoHorizontalOverflow,
  expectToast,
  loginAs
} = require('./support/rungis-fixtures');

test.describe('safe functional workflows', () => {
  test('client order page validates cart actions without mutating data', async ({ page }) => {
    const issues = collectBrowserIssues(page);

    await loginAs(page, 'client');
    await page.goto('/order');

    await expect(page.getByRole('button', { name: 'Catalog' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Favorites' })).toBeVisible();
    await page.getByRole('button', { name: 'Favorites' }).click();
    await expect(page.locator('form').getByRole('button').last()).toBeVisible();
    await page.locator('form').getByRole('button').last().click();
    await expectToast(page, 'Select an item and a valid quantity.');

    await page.getByRole('button', { name: 'Catalog' }).click();
    await expect(page.locator('#cart-group-by')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cart' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    expectNoBrowserIssues(issues);
  });

  test('vendor stock page validates required merchandise fields without creating stock', async ({ page }) => {
    const issues = collectBrowserIssues(page);

    await loginAs(page, 'vendor');
    await page.goto('/stocks');

    await page.locator('#stock-name').fill('');
    await page.locator('#stock-reference').fill('');
    await page.locator('#stock-price').fill('');
    await page.locator('#stock-qty').fill('');
    await page.getByRole('button', { name: /^create$/i }).click();

    await expectToast(page, 'Fill in all stock fields with valid non-negative price and stock.');
    await expect(page.locator('#stock-category')).toBeVisible();
    await expect(page.locator('#stock-min-threshold')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    expectNoBrowserIssues(issues);
  });

  test('administrator settings validate input before saving', async ({ page }) => {
    const issues = collectBrowserIssues(page);

    await loginAs(page, 'admin');
    await page.goto('/admin');

    await page.locator('#admin-bill-overdue-days').fill('0');
    await page.getByRole('button', { name: 'Save changes' }).first().click();
    await expectToast(page, 'Enter a valid number of days between 1 and 3650.');

    await expect(page.locator('#admin-app-style-primary')).toBeVisible();
    await expect(page.locator('#admin-app-style-secondary')).toBeVisible();
    await expect(page.locator('#assoc-client-select')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    expectNoBrowserIssues(issues);
  });
});

test.describe('global UX controls', () => {
  test('language and theme controls are accessible and persistent on dashboard', async ({ page }) => {
    const issues = collectBrowserIssues(page);

    await loginAs(page, 'client');

    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByRole('button', { name: /French|Français/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Rungis Online|Rungis Portal/i })).toBeVisible();

    const themeButton = page.locator('button.app-header__button').filter({ hasText: /Theme/ });
    await expect(themeButton).toBeVisible();
    await themeButton.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', /light|dark/);
    await themeButton.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', /dark|light/);

    await page.reload();
    await expect(page.getByRole('button', { name: /French|Français/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    expectNoBrowserIssues(issues);
  });

  test('keyboard focus can reach primary login controls', async ({ page }) => {
    const issues = collectBrowserIssues(page);

    await page.goto('/login');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    const focusedId = await page.evaluate(() => document.activeElement?.id || document.activeElement?.textContent?.trim());
    expect(String(focusedId)).toMatch(/login-username|login-password|Sign in|Language|Theme/i);
    await expectNoHorizontalOverflow(page);

    expectNoBrowserIssues(issues);
  });
});
