/**
 * Deterministic e2e fixtures (SPEC-013, EPIC-004).
 *
 * Seeded into the throwaway database behind e2e runs — the mobile-e2e CI
 * job today (via `pnpm seed:e2e`), and importable by future Maestro-flow
 * assertions / the web Playwright suite so expected values are never
 * duplicated by hand.
 *
 * Every ID and value is constant: flows assert exact figures, and the
 * seed is idempotent (upserts) so a CI retry can't fail on conflicts.
 * Dates are fixed absolutes, not relative to run time — determinism wins
 * over "today inside the destination range" (see SPEC-013 notes; revisit
 * if a destination-inference flow ever needs a live anchor).
 */
import type { drizzle } from 'drizzle-orm/postgres-js';
import {
  destinations,
  organizationMemberships,
  organizations,
  spendEntries,
  tripFixedCosts,
  trips,
  users,
} from '../schema';

type Db = ReturnType<typeof drizzle>;

export const E2E_FIXTURES = {
  user: {
    id: 'e2e-mobile-user',
    name: 'Mobile E2E',
    email: 'mobile-e2e@example.test',
    isApproved: true,
  },
  organization: {
    id: 'a0000000-0e2e-4000-8000-000000000001',
    name: 'E2E Travellers',
  },
  trip: {
    id: 'b0000000-0e2e-4000-8000-000000000001',
    name: 'Kyoto Adventure',
    totalBudgetPence: 500_000, // £5,000
    status: 'active',
  },
  destinations: [
    {
      id: 'c0000000-0e2e-4000-8000-000000000001',
      name: 'Kyoto',
      country: 'Japan',
      city: 'Kyoto',
      estimatedBudgetPence: 180_000,
      comfortLevel: 'mid',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      sortOrder: 0,
    },
    {
      id: 'c0000000-0e2e-4000-8000-000000000002',
      name: 'Tokyo',
      country: 'Japan',
      city: 'Tokyo',
      estimatedBudgetPence: 220_000,
      comfortLevel: 'mid',
      startDate: '2026-06-15',
      endDate: '2026-06-30',
      sortOrder: 1,
    },
  ],
  fixedCosts: [
    {
      id: 'd0000000-0e2e-4000-8000-000000000001',
      label: 'Flights to Japan',
      amountPence: 120_000,
      category: 'transport',
      date: '2026-05-01',
      sortOrder: 0,
    },
  ],
  spendEntries: [
    {
      id: 'e0000000-0e2e-4000-8000-000000000001',
      destinationId: 'c0000000-0e2e-4000-8000-000000000001',
      amountPence: 940,
      category: 'food',
      description: 'Ramen',
      spentAt: '2026-06-02',
    },
    {
      id: 'e0000000-0e2e-4000-8000-000000000002',
      destinationId: 'c0000000-0e2e-4000-8000-000000000001',
      amountPence: 2_500,
      category: 'transport',
      description: 'Bus day pass',
      spentAt: '2026-06-03',
    },
    {
      id: 'e0000000-0e2e-4000-8000-000000000003',
      destinationId: 'c0000000-0e2e-4000-8000-000000000002',
      amountPence: 12_000,
      category: 'accommodation',
      description: 'Capsule hotel night',
      spentAt: '2026-06-16',
    },
  ],
} as const;

export async function applyE2eFixtures(db: Db): Promise<void> {
  const f = E2E_FIXTURES;

  await db
    .insert(users)
    .values({
      id: f.user.id,
      name: f.user.name,
      email: f.user.email,
      isApproved: f.user.isApproved,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: { name: f.user.name, email: f.user.email, isApproved: f.user.isApproved },
    });

  await db
    .insert(organizations)
    .values({
      id: f.organization.id,
      name: f.organization.name,
      createdByUserId: f.user.id,
    })
    .onConflictDoUpdate({
      target: organizations.id,
      set: { name: f.organization.name },
    });

  await db
    .insert(organizationMemberships)
    .values({
      organizationId: f.organization.id,
      userId: f.user.id,
      role: 'owner',
    })
    .onConflictDoNothing();

  await db
    .insert(trips)
    .values({
      id: f.trip.id,
      organizationId: f.organization.id,
      name: f.trip.name,
      totalBudgetAmount: f.trip.totalBudgetPence,
      status: f.trip.status,
      ownerId: f.user.id,
    })
    .onConflictDoUpdate({
      target: trips.id,
      set: {
        name: f.trip.name,
        totalBudgetAmount: f.trip.totalBudgetPence,
        status: f.trip.status,
      },
    });

  for (const d of f.destinations) {
    await db
      .insert(destinations)
      .values({
        id: d.id,
        tripId: f.trip.id,
        name: d.name,
        country: d.country,
        city: d.city,
        estimatedBudgetAmount: d.estimatedBudgetPence,
        comfortLevel: d.comfortLevel,
        startDate: d.startDate,
        endDate: d.endDate,
        sortOrder: d.sortOrder,
      })
      .onConflictDoUpdate({
        target: destinations.id,
        set: {
          name: d.name,
          country: d.country,
          city: d.city,
          estimatedBudgetAmount: d.estimatedBudgetPence,
          startDate: d.startDate,
          endDate: d.endDate,
          sortOrder: d.sortOrder,
        },
      });
  }

  for (const c of f.fixedCosts) {
    await db
      .insert(tripFixedCosts)
      .values({
        id: c.id,
        tripId: f.trip.id,
        label: c.label,
        amountPence: c.amountPence,
        category: c.category,
        date: c.date,
        sortOrder: c.sortOrder,
      })
      .onConflictDoUpdate({
        target: tripFixedCosts.id,
        set: { label: c.label, amountPence: c.amountPence, category: c.category, date: c.date },
      });
  }

  for (const s of f.spendEntries) {
    await db
      .insert(spendEntries)
      .values({
        id: s.id,
        destinationId: s.destinationId,
        amount: s.amountPence,
        category: s.category,
        description: s.description,
        spentAt: s.spentAt,
      })
      .onConflictDoUpdate({
        target: spendEntries.id,
        set: { amount: s.amountPence, category: s.category, description: s.description },
      });
  }
}
