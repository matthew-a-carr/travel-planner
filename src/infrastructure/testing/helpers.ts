/**
 * Reusable integration test harness.
 *
 * Every integration test file should:
 *   1. Call createTestDb() in beforeAll — obtains a scoped DB connection.
 *   2. Call sql.end() in afterAll — releases the connection.
 *   3. Call truncateAll(db) in beforeEach — guarantees a clean slate per test.
 *   4. Use the seed factories to insert the minimal data each test needs.
 *
 * The POSTGRES_URL environment variable is set by global-setup.ts before
 * any test file is evaluated, so createTestDb() is always safe to call
 * inside beforeAll (not at module evaluation time).
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type {
  Destination,
  FixedCostCategory,
  SpendEntry,
  Trip,
  TripFixedCost,
} from '../../domain/trip/types';
import { money } from '../../domain/trip/types';
import * as schema from '../db/schema';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Db = ReturnType<typeof drizzle<typeof schema>>;
export type Sql = ReturnType<typeof postgres>;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Extracts the first row from a Drizzle `.returning()` result.
 * Throws if the insert returned no rows, which should never happen under normal
 * Postgres operation but gives a clear error if it does.
 */
function requireFirstRow<T>(rows: T[], context: string): T {
  const row = rows[0];
  if (row === undefined) throw new Error(`${context} returned no rows`);
  return row;
}

// ─── Connection ───────────────────────────────────────────────────────────────

/**
 * Creates a scoped Postgres connection backed by the Testcontainers database.
 * Call this in beforeAll; call sql.end() in afterAll.
 *
 * Do NOT import the application db singleton (src/infrastructure/db/client.ts)
 * in tests — use this instead so each test file owns its connection lifecycle.
 */
export function createTestDb(): { db: Db; sql: Sql } {
  const url = process.env.POSTGRES_URL;
  if (!url) throw new Error('POSTGRES_URL not set — did global-setup.ts run?');
  const sql = postgres(url);
  const db = drizzle(sql, { schema });
  return { db, sql };
}

// ─── Isolation ────────────────────────────────────────────────────────────────

/**
 * Deletes all rows from every application table in foreign-key–safe order.
 * Call this in beforeEach to guarantee a clean slate for each test.
 */
export async function truncateAll(db: Db): Promise<void> {
  await db.delete(schema.spendEntries);
  await db.delete(schema.destinations);
  await db.delete(schema.tripFixedCosts);
  await db.delete(schema.trips);
  await db.delete(schema.organizationMemberships);
  await db.delete(schema.organizations);
  await db.delete(schema.sessions);
  await db.delete(schema.accounts);
  await db.delete(schema.users);
  await db.delete(schema.countryReferenceData);
}

// ─── Seed factories ───────────────────────────────────────────────────────────
//
// Each factory inserts a minimal valid row and returns the mapped domain object.
// Override only the fields you need for a specific test — defaults are chosen
// to pass all domain invariants without any further setup.

export async function seedUser(
  db: Db,
  overrides: {
    id?: string;
    name?: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string;
    isApproved?: boolean;
    isAdmin?: boolean;
  } = {},
): Promise<{ id: string; email: string }> {
  const id = overrides.id ?? crypto.randomUUID();
  const email = overrides.email ?? `test-${id}@example.com`;
  const name = overrides.name ?? 'Test User';
  const firstName = overrides.firstName ?? null;
  const lastName = overrides.lastName ?? null;
  const isApproved = overrides.isApproved ?? false;
  const isAdmin = overrides.isAdmin ?? false;

  await db.insert(schema.users).values({
    id,
    name,
    firstName,
    lastName,
    email,
    isApproved,
    isAdmin,
    emailVerified: null,
    image: null,
  });

  return { id, email };
}

export async function seedTrip(
  db: Db,
  ownerId: string,
  overrides: {
    id?: string;
    organizationId?: string;
    name?: string;
    totalBudgetPence?: number;
    currency?: string;
    status?: string;
  } = {},
): Promise<Trip> {
  const id = overrides.id ?? crypto.randomUUID();
  const organizationId =
    overrides.organizationId ??
    (
      await seedOrganization(db, ownerId, {
        name: 'Test Workspace',
      })
    ).id;
  const name = overrides.name ?? 'Test Trip';
  const totalBudgetPence = overrides.totalBudgetPence ?? 5_000_000; // £50,000
  const currency = overrides.currency ?? 'GBP';
  const status = overrides.status ?? 'planning';
  const now = new Date();

  const rows = await db
    .insert(schema.trips)
    .values({
      id,
      organizationId,
      ownerId,
      name,
      totalBudgetAmount: totalBudgetPence,
      totalBudgetCurrency: currency,
      status,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const row = requireFirstRow(rows, 'seedTrip');
  return {
    id: row.id,
    organizationId: row.organizationId,
    ownerId: row.ownerId,
    name: row.name,
    totalBudget: money(row.totalBudgetAmount, row.totalBudgetCurrency as 'GBP'),
    status: row.status as 'planning',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function seedOrganization(
  db: Db,
  ownerUserId: string,
  overrides: { id?: string; name?: string } = {},
): Promise<{ id: string; name: string; createdByUserId: string }> {
  const id = overrides.id ?? crypto.randomUUID();
  const name = overrides.name ?? "Owner's Workspace";
  const now = new Date();

  await db.insert(schema.organizations).values({
    id,
    name,
    createdByUserId: ownerUserId,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.organizationMemberships).values({
    organizationId: id,
    userId: ownerUserId,
    role: 'owner',
    createdAt: now,
  });

  return {
    id,
    name,
    createdByUserId: ownerUserId,
  };
}

export async function seedOrganizationMember(
  db: Db,
  organizationId: string,
  userId: string,
  role: 'owner' | 'member' = 'member',
): Promise<void> {
  await db.insert(schema.organizationMemberships).values({
    organizationId,
    userId,
    role,
    createdAt: new Date(),
  });
}

export async function seedDestination(
  db: Db,
  tripId: string,
  overrides: {
    id?: string;
    name?: string;
    country?: string;
    city?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    estimatedBudgetPence?: number;
    currency?: string;
    comfortLevel?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    sortOrder?: number;
  } = {},
): Promise<Destination> {
  const id = overrides.id ?? crypto.randomUUID();
  const name = overrides.name ?? 'Japan';
  const country = overrides.country ?? 'Japan';
  const city = overrides.city !== undefined ? overrides.city : null;
  const latitude = overrides.latitude !== undefined ? overrides.latitude : null;
  const longitude = overrides.longitude !== undefined ? overrides.longitude : null;
  const estimatedBudgetPence = overrides.estimatedBudgetPence ?? 1_000_000; // £10,000
  const currency = overrides.currency ?? 'GBP';
  const comfortLevel = overrides.comfortLevel ?? 'mid';
  const sortOrder = overrides.sortOrder ?? 0;
  const startDate = overrides.startDate !== undefined ? overrides.startDate : null;
  const endDate = overrides.endDate !== undefined ? overrides.endDate : null;
  const now = new Date();

  const rows = await db
    .insert(schema.destinations)
    .values({
      id,
      tripId,
      name,
      country,
      city,
      latitude,
      longitude,
      estimatedBudgetAmount: estimatedBudgetPence,
      estimatedBudgetCurrency: currency,
      comfortLevel,
      startDate: startDate?.toISOString().split('T')[0] ?? null,
      endDate: endDate?.toISOString().split('T')[0] ?? null,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  const row = requireFirstRow(rows, 'seedDestination');
  return {
    id: row.id,
    tripId: row.tripId,
    name: row.name,
    country: row.country,
    city: row.city,
    latitude: row.latitude,
    longitude: row.longitude,
    estimatedBudget: money(row.estimatedBudgetAmount, row.estimatedBudgetCurrency as 'GBP'),
    comfortLevel: row.comfortLevel as 'mid',
    startDate: row.startDate ? new Date(row.startDate) : null,
    endDate: row.endDate ? new Date(row.endDate) : null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function seedFixedCost(
  db: Db,
  tripId: string,
  overrides: {
    id?: string;
    label?: string;
    amountPence?: number;
    category?: string;
    date?: Date;
    sortOrder?: number;
  } = {},
): Promise<TripFixedCost> {
  const id = overrides.id ?? crypto.randomUUID();
  const label = overrides.label ?? 'Flights';
  const amountPence = overrides.amountPence ?? 100_000; // £1,000
  const category = overrides.category ?? 'other';
  const date = overrides.date ?? new Date();
  const sortOrder = overrides.sortOrder ?? 0;
  const now = new Date();

  const rows = await db
    .insert(schema.tripFixedCosts)
    .values({
      id,
      tripId,
      label,
      amountPence,
      currency: 'GBP',
      category,
      date: date.toISOString().split('T')[0],
      sortOrder,
      createdAt: now,
    })
    .returning();

  const row = requireFirstRow(rows, 'seedFixedCost');
  return {
    id: row.id,
    tripId: row.tripId,
    label: row.label,
    amount: money(row.amountPence, 'GBP'),
    category: row.category as FixedCostCategory,
    date: new Date(row.date),
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
  };
}

export async function seedCountryReference(
  db: Db,
  overrides: {
    country?: string;
    alpha2?: string;
    alpha3?: string;
    region?: string;
    subregion?: string;
    avgDailyCostPence?: number;
    currency?: string;
    source?: 'manual' | 'estimated';
  } = {},
): Promise<{ country: string; avgDailyCostPence: number }> {
  const country = overrides.country ?? 'Japan';
  const alpha2 = overrides.alpha2 ?? 'JP';
  const alpha3 = overrides.alpha3 ?? 'JPN';
  const region = overrides.region ?? 'Asia';
  const subregion = overrides.subregion ?? 'Eastern Asia';
  const avgDailyCostPence = overrides.avgDailyCostPence ?? 7_500; // £75/day mid-range
  const currency = overrides.currency ?? 'GBP';
  const source = overrides.source ?? 'manual';

  await db.insert(schema.countryReferenceData).values({
    country,
    alpha2,
    alpha3,
    region,
    subregion,
    avgDailyCostPence,
    currency,
    source,
  });

  return { country, avgDailyCostPence };
}

export async function seedSpendEntry(
  db: Db,
  destinationId: string,
  overrides: {
    id?: string;
    amountPence?: number;
    category?: string;
    description?: string | null;
    spentAt?: Date;
  } = {},
): Promise<SpendEntry> {
  const id = overrides.id ?? crypto.randomUUID();
  const amountPence = overrides.amountPence ?? 5_000; // £50
  const category = overrides.category ?? 'food';
  const description = overrides.description !== undefined ? overrides.description : null;
  const spentAt = overrides.spentAt ?? new Date('2026-06-15');
  const now = new Date();

  const rows = await db
    .insert(schema.spendEntries)
    .values({
      id,
      destinationId,
      amount: amountPence,
      currency: 'GBP',
      category,
      description,
      spentAt: spentAt.toISOString().substring(0, 10),
      createdAt: now,
    })
    .returning();

  const row = requireFirstRow(rows, 'seedSpendEntry');
  return {
    id: row.id,
    destinationId: row.destinationId,
    amount: money(row.amount, 'GBP'),
    category: row.category as 'food',
    description: row.description,
    spentAt: new Date(row.spentAt),
    createdAt: row.createdAt,
  };
}

export async function seedCityReference(
  db: Db,
  overrides: {
    city?: string;
    country?: string;
    costMultiplier?: number;
    source?: 'manual' | 'estimated';
  } = {},
): Promise<{ city: string; country: string; costMultiplier: number }> {
  const city = overrides.city ?? 'Tokyo';
  const country = overrides.country ?? 'Japan';
  const costMultiplier = overrides.costMultiplier ?? 1.5;
  const source = overrides.source ?? 'manual';

  await db.insert(schema.cityReferenceData).values({
    city,
    country,
    costMultiplier,
    source,
  });

  return { city, country, costMultiplier };
}
