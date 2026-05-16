import { expect, test } from '@playwright/test';

/**
 * Trip timeline tab smoke tests.
 *
 * Self-contained: creates its own trip per test so we don't depend on the
 * state left behind by earlier specs.
 *
 * Validates:
 * - The Timeline tab is reachable from the trip detail page.
 * - The Paste itinerary panel renders.
 * - The Insights panel renders.
 * - With AI_GATEWAY_API_KEY unset (CI default), submitting a paste shows
 *   the "AI gateway not configured" error from the no-op fallback,
 *   confirming the env-var-driven graceful degradation works end-to-end.
 */

async function createTrip(
  page: import('@playwright/test').Page,
  tripName: string,
  totalBudget = '20000',
) {
  await page.goto('/');
  await page.getByRole('button', { name: /create trip/i }).first().click();
  await page.getByLabel('Trip name').fill(tripName);
  await page.getByLabel('Total budget').fill(totalBudget);
  await page.locator('form').getByRole('button', { name: /create trip/i }).click();

  await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+/);
  await expect(page.getByRole('heading', { name: tripName })).toBeVisible();
}

test.describe('Trip timeline', () => {
  test('renders the timeline tab with paste panel and insights panel', async ({ page }) => {
    await createTrip(page, `Timeline Smoke ${Date.now()}`);

    await page.getByRole('link', { name: 'Timeline', exact: true }).click();
    await expect(page).toHaveURL(/\/trips\/[^/]+\/timeline$/);

    await expect(page.getByRole('heading', { name: 'Paste an itinerary' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible();
  });

  test('shows a clear error when the AI gateway is unavailable', async ({ page }) => {
    await createTrip(page, `Timeline AI-Off ${Date.now()}`);
    await page.getByRole('link', { name: 'Timeline', exact: true }).click();

    await page
      .getByPlaceholder(/3 weeks Vietnam from Aug 1/i)
      .fill('3 weeks Vietnam from Aug 1, then Cambodia for 10 days');
    await page.getByRole('button', { name: /Extract destinations/i }).click();

    // Without any AI Gateway credentials the no-op parser surfaces a clear message.
    await expect(page.getByText(/AI_GATEWAY_API_KEY|unavailable/i)).toBeVisible();
  });
});
