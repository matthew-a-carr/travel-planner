import { eq } from 'drizzle-orm';
import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';
import type { Currency, FixedCostCategory, TripFixedCost } from '@/domain/trip/types';
import { moneyUnchecked } from '@/domain/trip/types';
import type { Db } from '../client';
import { tripFixedCosts } from '../schema';

function toFixedCost(row: typeof tripFixedCosts.$inferSelect): TripFixedCost {
  return {
    id: row.id,
    tripId: row.tripId,
    label: row.label,
    amount: moneyUnchecked(row.amountPence, row.currency as Currency),
    category: row.category as FixedCostCategory,
    date: new Date(row.date),
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
  };
}

export class DrizzleTripFixedCostRepository implements TripFixedCostRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<TripFixedCost | null> {
    const rows = await this.db.select().from(tripFixedCosts).where(eq(tripFixedCosts.id, id));
    return rows[0] ? toFixedCost(rows[0]) : null;
  }

  async findByTrip(tripId: string): Promise<TripFixedCost[]> {
    const rows = await this.db
      .select()
      .from(tripFixedCosts)
      .where(eq(tripFixedCosts.tripId, tripId))
      .orderBy(tripFixedCosts.sortOrder, tripFixedCosts.createdAt);
    return rows.map(toFixedCost);
  }

  async save(fixedCost: TripFixedCost): Promise<TripFixedCost> {
    const result = await this.db
      .insert(tripFixedCosts)
      .values({
        id: fixedCost.id,
        tripId: fixedCost.tripId,
        label: fixedCost.label,
        amountPence: fixedCost.amount.amountPence,
        currency: fixedCost.amount.currency,
        category: fixedCost.category,
        date: fixedCost.date.toISOString().split('T')[0],
        sortOrder: fixedCost.sortOrder,
        createdAt: fixedCost.createdAt,
      })
      .onConflictDoUpdate({
        target: tripFixedCosts.id,
        set: {
          label: fixedCost.label,
          amountPence: fixedCost.amount.amountPence,
          currency: fixedCost.amount.currency,
          category: fixedCost.category,
          date: fixedCost.date.toISOString().split('T')[0],
          sortOrder: fixedCost.sortOrder,
        },
      })
      .returning();
    if (!result[0]) throw new Error('Failed to save fixed cost');
    return toFixedCost(result[0]);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(tripFixedCosts).where(eq(tripFixedCosts.id, id));
  }
}
