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

    await page.getByRole('button', { name: /create trip/i }).click();

    // Should redirect to /trips/[uuid]
    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+/);
    await expect(page.getByRole('heading', { name: 'Test Round the World' })).toBeVisible();

    // Add a fixed cost on the trip detail page (ADR 005: fixed costs live here, not in the create form)
    await page.getByLabel('Label').fill('Australia Visa & Living');
    await page.getByLabel('Amount (£)').fill('16000');
    await page.getByRole('button', { name: 'Add' }).click();

    await expect(page.getByText('Australia Visa & Living')).toBeVisible();
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

test.describe('Trip editing', () => {
  test('authenticated user can edit a trip name, budget, and status', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Test Round the World').click();

    // Open edit modal
    await page.getByRole('button', { name: /edit trip/i }).click();
    await expect(page.getByRole('heading', { name: /edit trip/i })).toBeVisible();

    // Pre-populated fields should reflect current trip values
    await expect(page.getByLabel('Trip name')).toHaveValue('Test Round the World');

    // Update name, budget, and status
    await page.getByLabel('Trip name').fill('Big Adventure');
    await page.getByLabel('Total budget').fill('60000');
    await page.getByLabel('Status').selectOption('active');

    await page.getByRole('button', { name: /save changes/i }).click();

    // Heading and status badge should reflect the update
    await expect(page.getByRole('heading', { name: 'Big Adventure' })).toBeVisible();
    await expect(page.getByText('£60,000.00')).toBeVisible();
    await expect(page.getByText('active')).toBeVisible();
  });

  test('edit trip shows error when budget is reduced below existing allocations', async ({
    page,
  }) => {
    await page.goto('/');
    // Navigate to the trip and add a destination so budget is allocated
    await page.getByText('Big Adventure').click();

    await page.getByRole('button', { name: /edit trip/i }).click();

    // Try to set budget lower than the £16,000 fixed cost already on the trip
    await page.getByLabel('Total budget').fill('1');
    await page.getByRole('button', { name: /save changes/i }).click();

    await expect(
      page.getByText(/budget.*too small|reduce fixed costs/i),
    ).toBeVisible();
  });

  test('edited trip name appears on the dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Big Adventure')).toBeVisible();
  });
});
