import { test, expect, type Page } from '@playwright/test';

/**
 * Trip management journeys.
 *
 * Runs first (01-) so that the "Test Round the World" trip created here
 * is available to subsequent destination and spend tests.
 *
 * Auth is provided via the storageState written by global.setup.ts.
 */

function tripLink(page: Page, name: string) {
  return page.getByRole('link').filter({ hasText: name }).first();
}

async function openExistingTrip(page: Page, ...candidateNames: string[]) {
  for (const name of candidateNames) {
    const link = tripLink(page, name);
    if ((await link.count()) > 0) {
      await link.click();
      return;
    }
  }
  throw new Error(`Could not find trip link for: ${candidateNames.join(', ')}`);
}

test.describe('Trip creation', () => {
  test('authenticated user can open the create trip modal', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /create trip/i }).first().click();
    await expect(page.getByRole('heading', { name: /new trip/i })).toBeVisible();
  });

  test('authenticated user can create a trip and is redirected to trip detail', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /create trip/i }).first().click();

    await page.getByLabel('Trip name').fill('Test Round the World');
    await page.getByLabel('Total budget').fill('50000');

    await page.locator('form').getByRole('button', { name: /create trip/i }).click();

    // Should redirect to /trips/[uuid]
    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+/);
    await expect(page.getByRole('heading', { name: 'Test Round the World' })).toBeVisible();

    // Add a fixed cost on the trip detail page (ADR 005: fixed costs live here, not in the create form)
    const fixedCostForm = page.locator('form').filter({ has: page.locator('#fc-label') });
    await fixedCostForm.getByLabel('Label').fill('Australia Visa & Living');
    await fixedCostForm.getByLabel('Amount (£)').fill('16000');
    await fixedCostForm.getByLabel('Category').selectOption('accommodation');
    await fixedCostForm.getByRole('button', { name: /^Add$/ }).click();

    await expect(page.getByRole('button', { name: /remove australia visa & living/i })).toBeVisible();
    await expect(page.getByText('accommodation')).toBeVisible();
  });

  test('created trip appears on dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(tripLink(page, 'Test Round the World')).toBeVisible();
  });
});

test.describe('Trip detail page', () => {
  test('shows budget overview with correct figures', async ({ page }) => {
    await page.goto('/');
    await tripLink(page, 'Test Round the World').click();

    await expect(page.getByText(/budget overview/i)).toBeVisible();
    await expect(page.getByText(/£50,?000\.00/)).toBeVisible();
    await expect(page.getByRole('button', { name: /remove australia visa & living/i })).toBeVisible();
  });
});

test.describe('Trip editing', () => {
  test('authenticated user can edit a trip name, budget, and status', async ({ page }) => {
    await page.goto('/');
    await openExistingTrip(page, 'Test Round the World', 'Big Adventure');

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
    await expect(page.getByText(/£60,?000\.00/)).toBeVisible();
    await expect(page.locator('header span').filter({ hasText: /^active$/i }).first()).toBeVisible();
  });

  test('edit trip shows error when budget is reduced below existing allocations', async ({
    page,
  }) => {
    await page.goto('/');
    await openExistingTrip(page, 'Big Adventure', 'Test Round the World');

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
    await expect(tripLink(page, 'Big Adventure')).toBeVisible();
  });
});

test.describe('Fixed cost editing', () => {
  test('user can edit a fixed cost label, amount, category, and date', async ({ page }) => {
    await page.goto('/');
    await openExistingTrip(page, 'Big Adventure', 'Test Round the World');

    // Click Edit on the existing fixed cost
    await page.getByRole('button', { name: /edit australia visa & living/i }).click();

    // The edit form should appear — update the fields
    const editForm = page.locator('form').filter({ has: page.locator('[name="label"]') }).last();
    await editForm.getByLabel('Label').fill('Flights & Visa');
    await editForm.getByLabel('Amount (£)').fill('18000');
    await editForm.getByLabel('Category').selectOption('transport');
    await editForm.getByLabel('Date').fill('2026-07-01');

    await editForm.getByRole('button', { name: /save changes/i }).click();

    // Verify the updated values appear in the row
    await expect(page.getByText('Flights & Visa')).toBeVisible();
    await expect(page.getByText('£18,000.00')).toBeVisible();
    await expect(page.getByText('transport')).toBeVisible();
  });

  test('user can add a fixed cost with a specific category', async ({ page }) => {
    await page.goto('/');
    await openExistingTrip(page, 'Big Adventure', 'Test Round the World');

    const fixedCostForm = page.locator('form').filter({ has: page.locator('#fc-label') });
    await fixedCostForm.getByLabel('Label').fill('Travel Insurance');
    await fixedCostForm.getByLabel('Amount (£)').fill('500');
    await fixedCostForm.getByLabel('Category').selectOption('insurance');
    await fixedCostForm.getByRole('button', { name: /^Add$/ }).click();

    await expect(page.getByText('Travel Insurance')).toBeVisible();
    await expect(page.getByText('insurance')).toBeVisible();
  });

  test('category breakdown shows correct totals', async ({ page }) => {
    await page.goto('/');
    await openExistingTrip(page, 'Big Adventure', 'Test Round the World');

    // The category breakdown section should be visible with at least one category
    await expect(page.getByText(/fixed costs by category/i)).toBeVisible();
  });
});

test.describe('Trip deletion', () => {
  test('owner can delete a trip from trip detail', async ({ page }) => {
    const tripName = `Trip To Delete ${Date.now()}`;

    await page.goto('/');
    await page.getByRole('button', { name: /create trip/i }).first().click();
    await page.getByLabel('Trip name').fill(tripName);
    await page.getByLabel('Total budget').fill('5000');
    await page.locator('form').getByRole('button', { name: /create trip/i }).click();

    await expect(page.getByRole('heading', { name: tripName })).toBeVisible();
    const tripUrl = page.url();

    await page.getByRole('button', { name: /delete trip/i }).click();
    await expect(page.getByRole('heading', { name: /delete trip/i })).toBeVisible();
    await page.getByRole('button', { name: /delete permanently/i }).click();

    await expect(page).toHaveURL('/');
    await expect(tripLink(page, tripName)).toHaveCount(0);

    const response = await page.goto(tripUrl);
    expect(response?.status()).toBe(404);
    await expect(page.getByText(/could not be found/i)).toBeVisible();
  });
});
