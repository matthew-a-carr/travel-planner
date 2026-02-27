import { test, expect } from '@playwright/test';

/**
 * Destination management journeys.
 *
 * Runs second (02-) — depends on the "Test Round the World" trip
 * created by 01-trips.spec.ts.
 *
 * Acceptance criteria:
 * - User can add a destination to a trip
 * - Destination appears in the trip detail page
 * - Adding a destination updates the available budget
 * - User cannot allocate more than the available budget
 * - User can edit a destination's details and budget
 * - Editing budget to the same value succeeds (no false rejection)
 * - Editing budget to an amount exceeding available headroom is rejected
 *
 * Note: "User can remove a destination" is tested in 03-spend.spec.ts after
 * all spend journeys complete, because 03-spend depends on the Japan
 * destination existing.
 */

test.describe('Destination management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a known trip (created by 01-trips.spec.ts)
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

    await page.getByRole('button', { name: /add destination/i }).click();

    await expect(page.getByText('Japan').first()).toBeVisible();
  });

  test('adding a destination reduces available budget', async ({ page }) => {
    // Available was £34,000 (50,000 - 16,000 ringfenced)
    // After adding Japan (£5,000) it should be £29,000
    await expect(page.getByText('£29,000.00').first()).toBeVisible();
  });

  test('user cannot add a destination exceeding available budget', async ({ page }) => {
    await page.getByRole('button', { name: /add destination/i }).click();

    await page.getByLabel(/name/i).fill('Expensive');
    await page.getByLabel(/country/i).fill('Monaco');
    await page.getByLabel(/estimated budget/i).fill('999999');
    await page.getByLabel(/comfort/i).selectOption('luxury');

    await page.getByRole('button', { name: /add destination/i }).click();

    await expect(page.getByText(/exceeds available budget/i)).toBeVisible();
  });

  test('user can edit a destination name and country', async ({ page }) => {
    await page.getByRole('button', { name: /edit japan/i }).click();

    await page.getByLabel(/name/i).fill('Japan (updated)');
    await page.getByLabel(/country/i).fill('Japan');
    await page.getByRole('button', { name: /save changes/i }).click();

    await expect(page.getByText('Japan (updated)').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /edit japan \(updated\)/i })).toBeVisible();
  });

  test('user can edit a destination budget (same value succeeds)', async ({ page }) => {
    // Regression guard: editing with the same budget must not be rejected.
    // Without the delta approach, canAllocateBudget would double-count the
    // existing allocation and falsely block this.
    await page.getByRole('button', { name: /edit japan/i }).click();

    // Budget field is pre-filled; submit without changing it
    await page.getByRole('button', { name: /save changes/i }).click();

    await expect(page.getByText('Japan').first()).toBeVisible();
    // Available budget unchanged at £29,000
    await expect(page.getByText('£29,000.00').first()).toBeVisible();
  });

  test('user cannot edit a destination to exceed available budget', async ({ page }) => {
    await page.getByRole('button', { name: /edit japan/i }).click();

    await page.getByLabel(/estimated budget/i).fill('999999');
    await page.getByRole('button', { name: /save changes/i }).click();

    await expect(page.getByText(/exceeds available budget/i)).toBeVisible();
  });

  test('user can cancel editing a destination', async ({ page }) => {
    await page.getByRole('button', { name: /edit japan/i }).click();
    await page.getByLabel(/name/i).fill('Should not save');
    await page.getByRole('button', { name: /cancel/i }).click();

    await expect(page.getByText('Japan').first()).toBeVisible();
    await expect(page.getByText('Should not save')).not.toBeVisible();
  });

});
