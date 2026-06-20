import { readFile } from 'node:fs/promises';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import {
  destinations,
  organizationMemberships,
  trips,
  userPassports,
  users,
} from '../../src/infrastructure/db/schema';
import { E2E_POSTGRES_URL_FILE } from './setup/e2e-env';

const E2E_EMAIL = 'e2e@travelplanner.test';

async function withDatabase<T>(fn: (db: ReturnType<typeof drizzle>) => Promise<T>): Promise<T> {
  const uri = (await readFile(E2E_POSTGRES_URL_FILE, 'utf8')).trim();
  const sql = postgres(uri, { max: 1 });
  const db = drizzle(sql);
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

/** Give the e2e user a GBR passport + DOB and seed an Australia trip. Returns the trip id. */
async function seedAustraliaTrip(): Promise<string> {
  return withDatabase(async (db) => {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, E2E_EMAIL));
    if (!user) throw new Error('e2e user not found');

    await db.update(users).set({ dateOfBirth: '2000-01-01' }).where(eq(users.id, user.id));
    await db
      .insert(userPassports)
      .values({ userId: user.id, nationality: 'GBR', label: 'UK passport', sortOrder: 0 })
      .onConflictDoNothing();

    const [membership] = await db
      .select({ organizationId: organizationMemberships.organizationId })
      .from(organizationMemberships)
      .where(and(eq(organizationMemberships.userId, user.id), eq(organizationMemberships.role, 'owner')));
    if (!membership) throw new Error('e2e user has no owned organization');

    const tripId = crypto.randomUUID();
    const now = new Date();
    await db.insert(trips).values({
      id: tripId,
      organizationId: membership.organizationId,
      ownerId: user.id,
      name: `Australia ${Date.now()}`,
      totalBudgetAmount: 3_000_000,
      totalBudgetCurrency: 'GBP',
      status: 'planning',
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(destinations).values({
      id: crypto.randomUUID(),
      tripId,
      name: 'Australia',
      country: 'Australia',
      city: null,
      latitude: null,
      longitude: null,
      estimatedBudgetAmount: 1_000_000,
      estimatedBudgetCurrency: 'GBP',
      comfortLevel: 'mid',
      startDate: '2026-03-01',
      endDate: '2026-03-20',
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    });

    return tripId;
  });
}

test('switching trip intent re-assesses Australia to the working-holiday visa and persists', async ({
  page,
}) => {
  const tripId = await seedAustraliaTrip();

  await page.goto(`/trips/${tripId}`);

  const visas = page.getByRole('region', { name: /visas/i });
  // Default intent (tourism) → the tourist eVisitor / ETA rule applies.
  await expect(visas.getByText(/Travel authorisation \(ETA\)/i)).toBeVisible();

  // Switch to working holiday — the select auto-submits and the panel re-assesses.
  await visas.getByLabel('Intent').selectOption('working-holiday');
  await expect(visas.getByText(/Visa required/i)).toBeVisible({ timeout: 10_000 });

  // The choice persists across a reload.
  await page.reload();
  await expect(page.getByRole('region', { name: /visas/i }).getByLabel('Intent')).toHaveValue(
    'working-holiday',
  );
});
