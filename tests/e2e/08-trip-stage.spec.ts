import { expect, test } from '@playwright/test';

/**
 * Stage-aware trip detail page + streamlined destination form.
 *
 * Acceptance criteria:
 * - A brand-new trip with no destinations or fixed costs shows the
 *   "What next?" panel and hides the Budget Overview / Charts / Journey Map.
 * - The destination form auto-fills the budget when country, dates, and
 *   comfort level are set.
 * - "Save and add another" submits the form, keeps it open, and clears
 *   the country / city / date / budget fields.
 * - The destination name field is optional; submitting without one falls
 *   back to the city, then the country.
 */

test.describe('Trip stage and streamlined destination form', () => {
  const tripName = `Stage Test ${Date.now()}`;

  test('empty trip shows "What next?" panel and hides budget overview', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /create trip/i }).first().click();
    await page.getByLabel('Trip name').fill(tripName);
    await page.getByLabel('Total budget').fill('20000');
    await page.locator('form').getByRole('button', { name: /create trip/i }).click();

    await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+/);
    await expect(page.getByRole('heading', { name: tripName })).toBeVisible();

    await expect(page.getByRole('heading', { name: /what next/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /budget overview/i })).toBeHidden();
    await expect(page.getByRole('link', { name: /add your first destination/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /add a fixed cost/i })).toBeVisible();
  });

  test('destination form auto-fills budget and supports save-and-add-another', async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByRole('link').filter({ hasText: tripName }).first().click();

    await page.getByRole('button', { name: /^add destination$/i }).click();

    const form = page.locator('form').filter({ has: page.locator('#dest-name') });
    const budgetInput = form.getByLabel(/estimated budget/i);

    // First destination — country + dates + comfort drives budget auto-fill.
    await form.getByLabel(/country/i).fill('Japan');
    await page.getByRole('option', { name: 'Japan' }).click();
    await form.locator('#dest-start').fill('2026-06-01');
    await form.locator('#dest-end').fill('2026-06-08');
    await form.getByLabel(/comfort/i).selectOption('mid');

    // Auto-fill should populate a positive value without the user typing one.
    await expect.poll(async () => Number(await budgetInput.inputValue())).toBeGreaterThan(0);
    const firstSuggestion = await budgetInput.inputValue();

    // Leave the name blank — the action falls back to the country.
    await form.getByRole('button', { name: /save and add another/i }).click();
    await expect(page.getByRole('button', { name: /^edit japan$/i })).toBeVisible();

    // Form stayed open and budget was cleared for the next entry.
    await expect(form).toBeVisible();
    await expect(budgetInput).toHaveValue('');

    // Second destination — different country, fresh auto-fill.
    await form.getByLabel(/country/i).fill('Thailand');
    await page.getByRole('option', { name: 'Thailand' }).click();
    await form.locator('#dest-start').fill('2026-06-09');
    await form.locator('#dest-end').fill('2026-06-16');

    await expect.poll(async () => Number(await budgetInput.inputValue())).toBeGreaterThan(0);
    const secondSuggestion = await budgetInput.inputValue();
    expect(secondSuggestion).not.toBe(firstSuggestion);

    await form.getByRole('button', { name: /^add destination$/i }).click();
    await expect(page.getByRole('button', { name: /^edit thailand$/i })).toBeVisible();
  });
});
