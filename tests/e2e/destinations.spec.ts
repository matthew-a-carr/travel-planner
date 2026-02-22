import { test, expect } from '@playwright/test';

/**
 * Destination management journeys.
 *
 * Acceptance criteria for the destination feature:
 * - User can add a destination to a trip
 * - Destination appears in the trip detail page
 * - Adding a destination updates the available budget
 * - User cannot allocate more than the available budget
 * - User can remove a destination
 */

test.describe('Destination management', () => {
  test.skip(!process.env.PLAYWRIGHT_AUTH_TOKEN, 'Requires authenticated session');

  test.beforeEach(async ({ page }) => {
    // Navigate to a known trip (created by auth fixture)
    await page.goto('/');
    await page.getByText('Test Round the World').click();
  });

  test('shows empty destinations state', async ({ page }) => {
    await expect(page.getByText(/no destinations added yet/i)).toBeVisible();
  });

  test('user can add a destination', async ({ page }) => {
    await page.getByRole('button', { name: /add destination/i }).click();

    await page.getByLabel(/name/i).fill('Japan');
    await page.getByLabel(/country/i).fill('Japan');
    await page.getByLabel(/estimated budget/i).fill('5000');
    await page.getByLabel(/comfort/i).selectOption('mid');

    await page.getByRole('button', { name: /save/i }).click();

    await expect(page.getByText('Japan')).toBeVisible();
  });

  test('adding a destination reduces available budget', async ({ page }) => {
    // Available was £34,000 (50,000 - 16,000 ringfenced)
    // After adding Japan (£5,000) it should be £29,000
    await expect(page.getByText('£29,000.00')).toBeVisible();
  });

  test('user cannot add a destination exceeding available budget', async ({ page }) => {
    await page.getByRole('button', { name: /add destination/i }).click();

    await page.getByLabel(/name/i).fill('Expensive');
    await page.getByLabel(/country/i).fill('Monaco');
    await page.getByLabel(/estimated budget/i).fill('999999');
    await page.getByLabel(/comfort/i).selectOption('luxury');

    await page.getByRole('button', { name: /save/i }).click();

    await expect(page.getByText(/exceeds available budget/i)).toBeVisible();
  });

  test('user can remove a destination', async ({ page }) => {
    await page.getByRole('button', { name: /remove japan/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page.getByText('Japan')).not.toBeVisible();
    // Available budget returns to £34,000
    await expect(page.getByText('£34,000.00')).toBeVisible();
  });
});
