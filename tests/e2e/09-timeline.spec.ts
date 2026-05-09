import { type Page, expect, test } from '@playwright/test';

/**
 * Timeline tab smoke test.
 *
 * Runs after the destination + spend tests so the seeded trip has at least
 * one dated destination on the timeline. Validates:
 *
 * - The Timeline tab is reachable from the trip detail page.
 * - The Paste itinerary panel renders.
 * - The Insights panel renders.
 *
 * The AI gateway is intentionally unconfigured in CI; the page must render
 * fine with the no-op AI fallbacks (only deterministic findings, "AI offline"
 * badge in the insights panel).
 */

function tripLink(page: Page, name: string) {
  return page.getByRole('link').filter({ hasText: name }).first();
}

async function openExistingTrip(page: Page, ...candidates: string[]) {
  for (const name of candidates) {
    const link = tripLink(page, name);
    if ((await link.count()) > 0) {
      await link.click();
      return;
    }
  }
  throw new Error(`Could not find trip link for: ${candidates.join(', ')}`);
}

test.describe('Trip timeline', () => {
  test('renders the timeline tab with paste panel and insights panel', async ({ page }) => {
    await page.goto('/');
    await openExistingTrip(
      page,
      'Test Round the World',
      'Round the World 2026',
      'Round the World',
    );

    await page.getByRole('link', { name: 'Timeline', exact: true }).click();
    await expect(page).toHaveURL(/\/trips\/[^/]+\/timeline$/);

    await expect(page.getByRole('heading', { name: 'Paste an itinerary' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Timeline', exact: true })).toBeVisible();
  });

  test('shows a clear error when the AI gateway is unavailable', async ({ page }) => {
    await page.goto('/');
    await openExistingTrip(
      page,
      'Test Round the World',
      'Round the World 2026',
      'Round the World',
    );
    await page.getByRole('link', { name: 'Timeline', exact: true }).click();

    await page
      .getByPlaceholder(/3 weeks Vietnam from Aug 1/i)
      .fill('3 weeks Vietnam from Aug 1, then Cambodia for 10 days');
    await page.getByRole('button', { name: /Extract destinations/i }).click();

    // Without AI_GATEWAY_API_KEY the no-op parser reports its unavailability.
    await expect(page.getByText(/AI_GATEWAY_API_KEY is not configured/i)).toBeVisible();
  });
});
