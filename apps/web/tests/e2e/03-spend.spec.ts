import { test, expect, type Page } from '@playwright/test';

/**
 * Spend entry journeys.
 *
 * Runs third (03-) — depends on the Japan destination created by
 * 02-destinations.spec.ts.
 *
 * Acceptance criteria:
 * - User can record a spend against a destination
 * - Spend appears in the destination spend list
 * - Total spend is shown per destination
 * - Budget overview reflects actual spend vs estimated
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

function recordSpendForm(page: Page) {
  return page.locator('form').filter({ has: page.locator('#spend-amount') });
}

function editSpendForm(page: Page) {
  return page
    .locator('form')
    .filter({ has: page.locator('input[id^="edit-spend-amount-"]') })
    .first();
}

function addDestinationForm(page: Page) {
  return page.locator('form').filter({ has: page.locator('#dest-name') });
}

async function ensureJapanDestination(page: Page) {
  const editJapanButton = page.getByRole('button', { name: /^edit japan$/i });
  if ((await editJapanButton.count()) > 0) return;

  await page.getByRole('button', { name: /add destination/i }).click();
  const form = addDestinationForm(page);
  await form.getByLabel(/name/i).fill('Japan');
  await form.getByLabel(/country/i).fill('Japan');
  await page.getByRole('option', { name: 'Japan' }).click();
  await form.getByLabel(/estimated budget/i).fill('5000');
  await form.getByLabel(/comfort/i).selectOption('mid');
  await form.getByRole('button', { name: /add destination/i }).click();

  await expect(editJapanButton.first()).toBeVisible();
}

test.describe('Spend recording', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await openExistingTrip(page, 'Big Adventure', 'Test Round the World');
    await ensureJapanDestination(page);
  });

  test('destination detail shows zero spend initially', async ({ page }) => {
    await expect(page.getByText(/^Spent:\s*£0\.00$/)).toBeVisible();
  });

  test('user can record a spend entry', async ({ page }) => {
    await page.getByRole('button', { name: /add spend/i }).click();

    const form = recordSpendForm(page);
    await form.getByLabel(/amount/i).fill('120.50');
    await form.getByLabel(/category/i).selectOption('food');
    await form.getByLabel(/description/i).fill('Ramen dinner');
    await form.getByLabel(/date/i).fill('2026-06-15');

    await form.getByRole('button', { name: /record spend/i }).click();

    await expect(page.getByRole('button', { name: /edit spend entry: food — ramen dinner/i })).toBeVisible();
    await expect(page.getByText(/^Spent:\s*£120\.50$/)).toBeVisible();
  });

  test('destination spend summary updates after recording', async ({ page }) => {
    await expect(page.getByText(/^Spent:\s*£120\.50$/)).toBeVisible();
  });

  test('user can edit a spend entry', async ({ page }) => {
    // Depends on "Ramen dinner" recorded in the previous test
    await page
      .getByRole('button', { name: /edit spend entry: food — ramen dinner/i })
      .first()
      .click();

    const form = editSpendForm(page);
    await form.getByLabel(/amount/i).fill('150.00');
    await form.getByLabel(/description/i).fill('Ramen dinner (updated)');

    await form.getByRole('button', { name: /save changes/i }).click();

    await expect(page.getByText('Ramen dinner (updated)')).toBeVisible();
    await expect(page.getByText(/^Spent:\s*£150\.00$/)).toBeVisible();
  });

  test('user can delete a spend entry', async ({ page }) => {
    const deleteButtons = page.getByRole('button', { name: /delete spend entry:/i });
    if ((await deleteButtons.count()) > 0) {
      await deleteButtons.first().click();
    }

    await expect(page.getByText('Ramen dinner (updated)')).not.toBeVisible();
    await expect(page.getByRole('button', { name: /edit spend entry:/i })).toHaveCount(0);
    await expect(page.getByText(/^Spent:\s*£0\.00$/).first()).toBeVisible();
  });
});
