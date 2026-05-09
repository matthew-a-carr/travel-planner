import { expect, test } from '@playwright/test';

/**
 * Trip assistant drawer — Slice 0 smoke tests.
 *
 * Self-contained: creates its own trip per test.
 *
 * Validates:
 * - The Assistant button is reachable from the trip detail page header.
 * - Opening the drawer hydrates with an empty thread (no prior messages).
 * - With AI_GATEWAY_API_KEY unset (CI default), submitting a message
 *   surfaces the no-op assistant's "AI Gateway not configured" error
 *   without crashing the drawer.
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

test.describe('Trip assistant drawer — Slice 0', () => {
  test('opens, hydrates an empty thread, and surfaces the AI-offline error', async ({ page }) => {
    await createTrip(page, `Assistant Smoke ${Date.now()}`);

    await page.getByTestId('open-assistant-drawer').click();

    const drawer = page.getByRole('dialog', { name: 'Trip assistant' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(/Ask anything about this trip/i)).toBeVisible();

    await drawer.getByLabel('Message').fill('Am I on pace?');
    await drawer.getByRole('button', { name: 'Send' }).click();

    // The user's message renders immediately.
    await expect(drawer.getByTestId('assistant-message-user')).toContainText('Am I on pace?');

    // Without AI credentials (CI default), the no-op adapter rejects the
    // request and the drawer surfaces the error instead of crashing.
    await expect(drawer.getByRole('alert')).toContainText(/AI Gateway|unavailable/i);
  });
});
