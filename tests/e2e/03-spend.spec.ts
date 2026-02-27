import { test, expect } from '@playwright/test';

/**
 * Spend entry journeys, plus destination removal.
 *
 * Runs third (03-) — depends on the Japan destination created by
 * 02-destinations.spec.ts.  The destination removal test is here (rather
 * than in 02-) because it must run after all spend journeys complete.
 *
 * Acceptance criteria:
 * - User can record a spend against a destination
 * - Spend appears in the destination spend list
 * - Total spend is shown per destination
 * - Budget overview reflects actual spend vs estimated
 * - User can remove a destination (tested last, after all spend journeys)
 */

test.describe('Spend recording', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByText('Test Round the World').click();
    // Destination was renamed to "Japan (updated)" by 02-destinations.spec.ts.
    // Use role=link so we match only the clickable name, not the country text.
    await page.getByRole('link', { name: /japan/i }).click();
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

    await page.getByRole('button', { name: /record spend/i }).click();

    await expect(page.getByText('Ramen dinner').first()).toBeVisible();
    await expect(page.getByText('£120.50').first()).toBeVisible();
  });

  test('total spend is shown correctly', async ({ page }) => {
    await expect(page.getByText(/total spent/i)).toBeVisible();
    await expect(page.getByText('£120.50').first()).toBeVisible();
  });

  test('user can edit a spend entry', async ({ page }) => {
    // Depends on "Ramen dinner" recorded in the previous test
    await page
      .getByRole('button', { name: /edit spend entry: food — ramen dinner/i })
      .click();

    await page.getByLabel(/amount/i).fill('150.00');
    await page.getByLabel(/description/i).fill('Ramen dinner (updated)');

    await page.getByRole('button', { name: /save changes/i }).click();

    await expect(page.getByText('Ramen dinner (updated)').first()).toBeVisible();
    await expect(page.getByText('£150.00').first()).toBeVisible();
  });

  test('user can delete a spend entry', async ({ page }) => {
    // Depends on the updated entry from the previous test
    await page
      .getByRole('button', { name: /delete spend entry: food — ramen dinner \(updated\)/i })
      .click();

    await expect(page.getByText('Ramen dinner (updated)')).not.toBeVisible();
    await expect(page.getByText(/no spend recorded/i)).toBeVisible();
  });
});

test.describe('Destination removal', () => {
  // Runs after all spend tests so the Japan destination can be removed cleanly.
  // By this point the destination was renamed to "Japan (updated)" by 02-destinations.spec.ts.
  test('user can remove a destination', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Test Round the World').click();

    // aria-label is "Remove Japan (updated)" — regex matches as a substring
    await page.getByRole('button', { name: /remove japan/i }).click();

    await expect(page.getByText('Japan').first()).not.toBeVisible();
    // Available budget returns to £34,000 (£50,000 - £16,000 fixed costs)
    await expect(page.getByText('£34,000.00').first()).toBeVisible();
  });
});
