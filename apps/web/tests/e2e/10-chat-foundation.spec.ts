import { expect, test } from '@playwright/test';

/**
 * Trip assistant drawer — Slice 0 / 2.5 smoke tests.
 *
 * Self-contained: creates its own trip per test.
 *
 * Validates:
 * - The Assistant button is reachable from the trip detail page header.
 * - Opening the drawer hydrates with an empty thread (no prior messages).
 * - With AI_GATEWAY_API_KEY unset (CI default), the no-op assistant
 *   streams an "AI Gateway is unavailable" assistant message via the
 *   UI message protocol — the drawer renders it as a normal assistant
 *   bubble rather than a special-cased error path. (Slice 2.5)
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

test.describe('Trip assistant drawer', () => {
  test('opens, hydrates an empty thread, and renders the offline assistant message', async ({
    page,
  }) => {
    await createTrip(page, `Assistant Smoke ${Date.now()}`);

    await page.getByTestId('open-assistant-drawer').click();

    const drawer = page.getByRole('dialog', { name: 'Trip assistant' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText(/Ask about this trip or tell me to make changes/i)).toBeVisible();

    await drawer.getByLabel('Message').fill('Am I on pace?');
    await drawer.getByRole('button', { name: 'Send' }).click();

    // The user's message renders immediately.
    await expect(drawer.getByTestId('assistant-message-user')).toContainText('Am I on pace?');

    // Without AI credentials (CI default), the no-op adapter streams an
    // "AI Gateway is unavailable…" assistant message via the standard
    // protocol — rendered as a normal assistant bubble.
    await expect(drawer.getByTestId('assistant-message-assistant')).toContainText(
      /unavailable/i,
    );
  });

  test('hydrates persisted history on reopen', async ({ page }) => {
    await createTrip(page, `Assistant Hydrate ${Date.now()}`);

    // Open, send a message, wait for the offline reply, then close.
    await page.getByTestId('open-assistant-drawer').click();
    let drawer = page.getByRole('dialog', { name: 'Trip assistant' });
    await drawer.getByLabel('Message').fill('Persisted question?');
    await drawer.getByRole('button', { name: 'Send' }).click();
    await expect(drawer.getByTestId('assistant-message-assistant')).toContainText(
      /unavailable/i,
    );
    await drawer.getByRole('button', { name: 'Close' }).click();
    await expect(drawer).not.toBeVisible();

    // Reopen — the same user message and the assistant reply hydrate
    // from chat_messages.parts.
    await page.getByTestId('open-assistant-drawer').click();
    drawer = page.getByRole('dialog', { name: 'Trip assistant' });
    await expect(drawer.getByTestId('assistant-message-user')).toContainText(
      'Persisted question?',
    );
    await expect(drawer.getByTestId('assistant-message-assistant')).toContainText(
      /unavailable/i,
    );
  });
});
