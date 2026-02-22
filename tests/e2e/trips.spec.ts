import { test, expect } from '@playwright/test';

/**
 * Trip management journeys.
 *
 * NOTE: These tests require an authenticated session.
 * Until a test-auth mechanism is wired up (session seeding or
 * a dedicated test OAuth provider), these tests are skipped.
 *
 * To run with auth: provide a PLAYWRIGHT_AUTH_TOKEN env var
 * or use the storageState pattern documented in playwright.config.ts.
 *
 * The test descriptions define the acceptance criteria for the feature.
 */

test.describe('Trip creation', () => {
  test.skip(!process.env.PLAYWRIGHT_AUTH_TOKEN, 'Requires authenticated session');

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
  test.skip(!process.env.PLAYWRIGHT_AUTH_TOKEN, 'Requires authenticated session');

  test('shows budget overview with correct figures', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Test Round the World').click();

    await expect(page.getByText(/budget overview/i)).toBeVisible();
    await expect(page.getByText('£50,000.00')).toBeVisible();
    await expect(page.getByText('Australia Visa & Living')).toBeVisible();
  });
});
