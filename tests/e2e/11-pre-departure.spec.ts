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
  test('renders the stub plan and one-click adds a fixed cost that dedupes', async ({ page }) => {
    await createTrip(page, `Pre-Departure E2E ${Date.now()}`);

    const panel = page.getByTestId('pre-departure-panel');
    await expect(panel).toBeVisible({ timeout: 15_000 });

    // Stub returns one addable item (with cost) and one info-only item.
    const addableRow = panel.locator('li').filter({ hasText: STUB_VISA_ITEM });
    await expect(addableRow).toBeVisible();

    const infoRow = panel.locator('li').filter({ hasText: STUB_INFO_ITEM });
    await expect(infoRow).toBeVisible();
    await expect(infoRow.getByText(/info only/i)).toBeVisible();

    const addButton = addableRow.getByRole('button', { name: /add as fixed cost/i });
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Server action + revalidation round trip — allow generous time on CI.
    await expect(addableRow.getByText(/already added/i)).toBeVisible({ timeout: 20_000 });

    // The new fixed cost appears in the Fixed costs section below.
    const fixedCosts = page.locator('#fixed-costs');
    await expect(fixedCosts.getByText(STUB_VISA_ITEM).first()).toBeVisible({ timeout: 15_000 });
  });
});
