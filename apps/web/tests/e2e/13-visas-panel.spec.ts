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

/** Give the e2e user a GBR passport and seed a Schengen-overstay trip. Returns the trip id. */
async function seedSchengenOverstayTrip(): Promise<string> {
  return withDatabase(async (db) => {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, E2E_EMAIL));
    if (!user) throw new Error('e2e user not found');

    await db
      .update(users)
      .set({ dateOfBirth: '1990-05-15' })
      .where(eq(users.id, user.id));
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
      name: `Schengen Overstay ${Date.now()}`,
      totalBudgetAmount: 2_000_000,
      totalBudgetCurrency: 'GBP',
      status: 'planning',
      createdAt: now,
      updatedAt: now,
    });

    const legs = [
      { country: 'France', start: '2026-01-01', end: '2026-02-10' }, // 40d
      { country: 'Italy', start: '2026-02-10', end: '2026-03-12' }, // 30d
      { country: 'Spain', start: '2026-03-12', end: '2026-04-06' }, // 25d → 95 total
    ];
    await db.insert(destinations).values(
      legs.map((leg, index) => ({
        id: crypto.randomUUID(),
        tripId,
        name: leg.country,
        country: leg.country,
        city: null,
        latitude: null,
        longitude: null,
        estimatedBudgetAmount: 500_000,
        estimatedBudgetCurrency: 'GBP',
        comfortLevel: 'mid',
        startDate: leg.start,
        endDate: leg.end,
        sortOrder: index,
        createdAt: now,
        updatedAt: now,
      })),
    );

    return tripId;
  });
}

test('the Visas panel surfaces a Schengen overstay on the trip page', async ({ page }) => {
  const tripId = await seedSchengenOverstayTrip();

  await page.goto(`/trips/${tripId}`);

  const visas = page.getByRole('region', { name: /visas/i });
  await expect(visas.getByRole('heading', { name: 'Visas' })).toBeVisible();
  await expect(visas.getByText('Schengen Area')).toBeVisible();
  await expect(visas.getByText(/exceeds the 90-day allowance/i)).toBeVisible();
});
