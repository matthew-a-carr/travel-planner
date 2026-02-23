import { test, expect } from '@playwright/test';

/**
 * Trip management journeys.
 *
 * Runs first (01-) so that the "Test Round the World" trip created here
 * is available to subsequent destination and spend tests.
 *
 * Auth is provided via the storageState written by global.setup.ts.
 */

test.describe('Trip creation', () => {
  test('authenticated user can open the create trip modal', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /create trip/i }).click();
    await expect(page.getByRole('heading', { name: /new trip/i })).toBeVisible();
  });

  test('authenticated user can create a trip and is redirected to trip detail', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /create trip/i }).click();

    await page.getByLabel('Trip name').fill('Test Round the World');
    await page.getByLabel('Total budget').fill('50000');
    await page.getByLabel(/amount/i).fill('16000');
    await page.getByLabel(/label/i).fill('Australia Visa & Living');

    await page.getByRole('button', { name: /create trip/i }).click();

    // Should redirect to /trips/[uuid]
    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+/);
    await expect(page.getByRole('heading', { name: 'Test Round the World' })).toBeVisible();
  });

  test('created trip appears on dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Test Round the World')).toBeVisible();
  });
});

test.describe('Trip detail page', () => {
  test('shows budget overview with correct figures', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Test Round the World').click();

    await expect(page.getByText(/budget overview/i)).toBeVisible();
    await expect(page.getByText('£50,000.00')).toBeVisible();
    await expect(page.getByText('Australia Visa & Living')).toBeVisible();
  });
});
