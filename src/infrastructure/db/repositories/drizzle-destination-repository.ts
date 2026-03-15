import { eq } from 'drizzle-orm';
import type { DestinationRepository } from '@/domain/destination/destination-repository';
import type { ComfortLevel, Currency, Destination } from '@/domain/trip/types';
import { money } from '@/domain/trip/types';
import type { Db } from '../client';
import { destinations } from '../schema';

function toDestination(row: typeof destinations.$inferSelect): Destination {
  return {
    id: row.id,
    tripId: row.tripId,
    name: row.name,
    country: row.country,
    city: row.city,
    latitude: row.latitude,
    longitude: row.longitude,
    estimatedBudget: money(row.estimatedBudgetAmount, row.estimatedBudgetCurrency as Currency),
    comfortLevel: row.comfortLevel as ComfortLevel,
    startDate: row.startDate ? new Date(row.startDate) : null,
    endDate: row.endDate ? new Date(row.endDate) : null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRow(d: Destination): typeof destinations.$inferInsert {
  return {
    id: d.id,
    tripId: d.tripId,
    name: d.name,
    country: d.country,
    city: d.city,
    latitude: d.latitude,
    longitude: d.longitude,
    estimatedBudgetAmount: d.estimatedBudget.amountPence,
    estimatedBudgetCurrency: d.estimatedBudget.currency,
    comfortLevel: d.comfortLevel,
    startDate: d.startDate?.toISOString().split('T')[0] ?? null,
    endDate: d.endDate?.toISOString().split('T')[0] ?? null,
    sortOrder: d.sortOrder,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export class DrizzleDestinationRepository implements DestinationRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<Destination | null> {
    const rows = await this.db.select().from(destinations).where(eq(destinations.id, id));
    return rows[0] ? toDestination(rows[0]) : null;
  }

  async findByTrip(tripId: string): Promise<Destination[]> {
    const rows = await this.db
      .select()
      .from(destinations)
      .where(eq(destinations.tripId, tripId))
      .orderBy(destinations.startDate, destinations.sortOrder, destinations.createdAt);
    return rows.map(toDestination);
  }

  async save(destination: Destination): Promise<Destination> {
    const row = toRow(destination);
    const result = await this.db
      .insert(destinations)
      .values(row)
      .onConflictDoUpdate({
        target: destinations.id,
        set: {
          name: row.name,
          country: row.country,
          city: row.city,
          latitude: row.latitude,
          longitude: row.longitude,
          estimatedBudgetAmount: row.estimatedBudgetAmount,
          estimatedBudgetCurrency: row.estimatedBudgetCurrency,
          comfortLevel: row.comfortLevel,
          startDate: row.startDate,
          endDate: row.endDate,
          sortOrder: row.sortOrder,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!result[0]) throw new Error('Failed to save destination');
    return toDestination(result[0]);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(destinations).where(eq(destinations.id, id));
  }
}
