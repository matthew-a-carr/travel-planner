import { test, expect } from '@playwright/test';

/**
 * Spend entry journeys.
 *
 * Acceptance criteria for spend recording:
 * - User can record a spend against a destination
 * - Spend appears in the destination spend list
 * - Total spend is shown per destination
 * - Budget overview reflects actual spend vs estimated
 */

test.describe('Spend recording', () => {
  test.skip(!process.env.PLAYWRIGHT_AUTH_TOKEN, 'Requires authenticated session');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByText('Test Round the World').click();
    // Assumes Japan destination exists from destination tests
    await page.getByText('Japan').click();
  });

  test('destination detail shows empty spend state', async ({ page }) => {
    await expect(page.getByText(/no spend recorded/i)).toBeVisible();
  });

  test('user can record a spend entry', async ({ page }) => {
    await page.getByRole('button', { name: /add spend/i }).click();

    await page.getByLabel(/amount/i).fill('120.50');
    await page.getByLabel(/category/i).selectOption('food');
    await page.getByLabel(/description/i).fill('Ramen dinner');
    await page.getByLabel(/date/i).fill('2026-06-15');

    await page.getByRole('button', { name: /save/i }).click();

    await expect(page.getByText('Ramen dinner')).toBeVisible();
    await expect(page.getByText('£120.50')).toBeVisible();
  });

  test('total spend is shown correctly', async ({ page }) => {
    await expect(page.getByText(/total spent/i)).toBeVisible();
    await expect(page.getByText('£120.50')).toBeVisible();
  });
});
