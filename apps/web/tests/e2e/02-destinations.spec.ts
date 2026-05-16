import { test, expect, type Page } from '@playwright/test';

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
 * - User can remove a destination
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

function addDestinationForm(page: Page) {
  return page.locator('form').filter({ has: page.locator('#dest-name') });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function editDestinationButton(page: Page, destinationName: string) {
  return page.getByRole('button', {
    name: new RegExp(`^edit ${escapeRegExp(destinationName)}$`, 'i'),
  });
}

function budgetOverviewCard(page: Page) {
  return page
    .locator('div')
    .filter({ has: page.getByRole('heading', { name: /budget overview/i }) })
    .first();
}

function primaryDestinationEditButton(page: Page) {
  return page.getByRole('button', { name: /^edit (?!trip|fixed cost:|spend entry:)/i }).first();
}

async function findExistingDestinationName(page: Page, ...candidateNames: string[]) {
  const editButton = primaryDestinationEditButton(page);
  await expect(editButton).toBeVisible();
  const ariaLabel = await editButton.getAttribute('aria-label');
  const destinationName = ariaLabel?.replace(/^edit\s+/i, '').trim();
  if (!destinationName) {
    throw new Error('Could not determine destination name from edit button aria-label');
  }
  return destinationName;
}

async function openDestinationEditor(page: Page) {
  const editButton = primaryDestinationEditButton(page);
  await expect(editButton).toBeVisible();
  const ariaLabel = await editButton.getAttribute('aria-label');
  await editButton.click();
  return ariaLabel?.replace(/^edit\s+/i, '').trim() ?? 'destination';
}

test.describe('Destination management', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a known trip (created by 01-trips.spec.ts)
    await page.goto('/');
    await openExistingTrip(page, 'Big Adventure', 'Test Round the World');
  });

  test('shows empty destinations state', async ({ page }) => {
    await expect(page.getByText(/no destinations added yet/i)).toBeVisible();
  });

  test('user can add a destination', async ({ page }) => {
    await page.getByRole('button', { name: /add destination/i }).click();

    const form = addDestinationForm(page);
    await form.getByLabel(/name/i).fill('Japan');
    await form.getByLabel(/country/i).fill('Japan');
    await page.getByRole('option', { name: 'Japan' }).click();
    await form.getByLabel(/estimated budget/i).fill('5000');
    await form.getByLabel(/comfort/i).selectOption('mid');

    await form.getByRole('button', { name: /add destination/i }).click();

    await expect(editDestinationButton(page, 'Japan')).toBeVisible();
  });

  test('adding a destination reduces available budget', async ({ page }) => {
    // Available was £41,500 (60,000 - 18,500 fixed costs)
    // After adding Japan (£5,000) it should be £36,500
    await expect(budgetOverviewCard(page)).toContainText(/£36,?500\.00/);
  });

  test('user cannot add a destination exceeding available budget', async ({ page }) => {
    await page.getByRole('button', { name: /add destination/i }).click();

    const form = addDestinationForm(page);
    await form.getByLabel(/name/i).fill('Expensive');
    await form.getByLabel(/country/i).fill('Monaco');
    await page.getByRole('option', { name: 'Monaco' }).click();
    await form.getByLabel(/estimated budget/i).fill('999999');
    await form.getByLabel(/comfort/i).selectOption('luxury');

    await form.getByRole('button', { name: /add destination/i }).click();

    await expect(page.getByText(/exceeds available budget/i)).toBeVisible();
  });

  test('user can edit a destination name and country', async ({ page }) => {
    await page.getByRole('button', { name: /edit japan/i }).click();

    await page.getByLabel(/name/i).fill('Japan (updated)');
    // Country combobox should already have 'Japan' selected — clear and re-select
    await page.getByLabel(/country/i).fill('Japan');
    await page.getByRole('option', { name: 'Japan' }).click();
    await page.getByRole('button', { name: /save changes/i }).click();

    await expect(editDestinationButton(page, 'Japan (updated)')).toBeVisible();
    await expect(page.getByRole('button', { name: /edit japan \(updated\)/i })).toBeVisible();
  });

  test('user can edit a destination budget (same value succeeds)', async ({ page }) => {
    // Regression guard: editing with the same budget must not be rejected.
    // Without the delta approach, canAllocateBudget would double-count the
    // existing allocation and falsely block this.
    const destinationName = await openDestinationEditor(page);

    // Budget field is pre-filled; submit without changing it
    await page.getByRole('button', { name: /save changes/i }).click();

    await expect(editDestinationButton(page, destinationName)).toBeVisible();
    // Available budget unchanged at £36,500
    await expect(budgetOverviewCard(page)).toContainText(/£36,?500\.00/);
  });

  test('user cannot edit a destination to exceed available budget', async ({ page }) => {
    await openDestinationEditor(page);

    await page.getByLabel(/estimated budget/i).fill('999999');
    await page.getByRole('button', { name: /save changes/i }).click();

    await expect(page.getByText(/exceeds available budget/i)).toBeVisible();
  });

  test('user can cancel editing a destination', async ({ page }) => {
    const destinationName = await openDestinationEditor(page);
    await page.getByLabel(/name/i).fill('Should not save');
    await page.getByRole('button', { name: /cancel/i }).click();

    await expect(editDestinationButton(page, destinationName)).toBeVisible();
    await expect(page.getByText('Should not save')).not.toBeVisible();
  });

  test('user can remove a destination', async ({ page }) => {
    const destinationName = await findExistingDestinationName(page);
    await page
      .getByRole('button', { name: new RegExp(`^remove ${escapeRegExp(destinationName)}$`, 'i') })
      .click();

    await expect(editDestinationButton(page, destinationName)).not.toBeVisible();
    // Available budget returns to £41,500
    await expect(budgetOverviewCard(page)).toContainText(/£41,?500\.00/);
  });
});
