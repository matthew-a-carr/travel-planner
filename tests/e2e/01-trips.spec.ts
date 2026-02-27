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

    // Use form-scoped selector to avoid strict mode violation (two "Create trip"
    // buttons exist when the modal is open: the backdrop trigger and the submit).
    await page.locator('form').getByRole('button', { name: /create trip/i }).click();

    // Should redirect to /trips/[uuid]
    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+/);
    await expect(page.getByRole('heading', { name: 'Test Round the World' })).toBeVisible();

    // Add a fixed cost on the trip detail page (ADR 005: fixed costs live here, not in the create form)
    await page.getByLabel('Label').fill('Australia Visa & Living');
    await page.getByLabel('Amount (£)').fill('16000');
    // exact: true prevents matching "Add destination" (partial match default)
    await page.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(page.getByText('Australia Visa & Living').first()).toBeVisible();
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
    await expect(page.getByText('Australia Visa & Living').first()).toBeVisible();
  });
});
