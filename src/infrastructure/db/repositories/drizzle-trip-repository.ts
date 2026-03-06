import { eq } from 'drizzle-orm';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { Currency, Trip, TripStatus } from '@/domain/trip/types';
import { money } from '@/domain/trip/types';
import type { Db } from '../client';
import { trips } from '../schema';

function toTrip(row: typeof trips.$inferSelect): Trip {
  return {
    id: row.id,
    organizationId: row.organizationId,
    ownerId: row.ownerId,
    name: row.name,
    totalBudget: money(row.totalBudgetAmount, row.totalBudgetCurrency as Currency),
    status: row.status as TripStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRow(trip: Trip): typeof trips.$inferInsert {
  return {
    id: trip.id,
    organizationId: trip.organizationId,
    ownerId: trip.ownerId,
    name: trip.name,
    totalBudgetAmount: trip.totalBudget.amountPence,
    totalBudgetCurrency: trip.totalBudget.currency,
    status: trip.status,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
  };
}

export class DrizzleTripRepository implements TripRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Trip | null> {
    const rows = await this.db.select().from(trips).where(eq(trips.id, id));
    return rows[0] ? toTrip(rows[0]) : null;
  }

  async findAllByOrganization(organizationId: string): Promise<Trip[]> {
    const rows = await this.db
      .select()
      .from(trips)
      .where(eq(trips.organizationId, organizationId))
      .orderBy(trips.createdAt);
    return rows.map(toTrip);
  }

  async save(trip: Trip): Promise<Trip> {
    const row = toRow(trip);
    const result = await this.db
      .insert(trips)
      .values(row)
      .onConflictDoUpdate({
        target: trips.id,
        set: {
          organizationId: row.organizationId,
          name: row.name,
          totalBudgetAmount: row.totalBudgetAmount,
          totalBudgetCurrency: row.totalBudgetCurrency,
          status: row.status,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!result[0]) throw new Error('Failed to save trip');
    return toTrip(result[0]);
  }
}
