import { expect, test, type Page } from '@playwright/test';

/**
 * Pre-departure planning panel smoke tests.
 *
 * The e2e webserver is started with `E2E_STUB_AI_SERVICES=true`
 * (see `tests/e2e/setup/start-web-server.ts`), which wires a
 * deterministic stub into the `PreDeparturePlannerService` slot so
 * the panel can be exercised without live AI credentials. The stub
 * returns two checklist items and no transport legs.
 *
 * See `src/infrastructure/ai/e2e-stub-pre-departure-planner.ts` and
 * ADR 045.
 */

const STUB_VISA_ITEM = 'E2E stub: Apply for visa';
const STUB_INFO_ITEM = 'E2E stub: Open multi-currency account';

async function createTrip(page: Page, tripName: string, totalBudget = '20000'): Promise<void> {
  await page.goto('/');
  await page.getByRole('button', { name: /create trip/i }).first().click();
  await page.getByLabel('Trip name').fill(tripName);
  await page.getByLabel('Total budget').fill(totalBudget);
  await page.locator('form').getByRole('button', { name: /create trip/i }).click();
  await expect(page).toHaveURL(/\/trips\/[0-9a-f-]+/);
  await expect(page.getByRole('heading', { name: tripName })).toBeVisible();
}

test.describe('Pre-departure planning panel', () => {
  test('renders the stub plan with addable + info-only rows', async ({ page }) => {
    await createTrip(page, `Pre-Departure E2E ${Date.now()}`);

    const panel = page.getByTestId('pre-departure-panel');
    await expect(panel).toBeVisible();

    // Stub returns one item with a cost (addable) and one info-only item.
    const addableRow = panel.locator('li', { hasText: STUB_VISA_ITEM });
    await expect(addableRow).toBeVisible();
    await expect(
      addableRow.getByRole('button', { name: /add as fixed cost/i }),
    ).toBeVisible();

    const infoRow = panel.locator('li', { hasText: STUB_INFO_ITEM });
    await expect(infoRow).toBeVisible();
    await expect(infoRow.getByText(/info only/i)).toBeVisible();
  });

  test('"Add as fixed cost" creates a fixed cost and the row dedupes', async ({ page }) => {
    await createTrip(page, `Pre-Departure E2E ${Date.now()}`);

    const panel = page.getByTestId('pre-departure-panel');
    const addableRow = panel.locator('li', { hasText: STUB_VISA_ITEM });
    await addableRow.getByRole('button', { name: /add as fixed cost/i }).click();

    // After the server action revalidates, the row marks itself "Already added".
    await expect(addableRow.getByText(/already added/i)).toBeVisible();

    // And the new fixed cost appears in the Fixed costs section below.
    const fixedCosts = page.locator('#fixed-costs');
    await expect(fixedCosts.getByText(STUB_VISA_ITEM)).toBeVisible();
  });
});
