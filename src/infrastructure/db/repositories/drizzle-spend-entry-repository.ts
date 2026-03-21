import { eq } from 'drizzle-orm';
import type { SpendEntryRepository } from '@/domain/spending/spend-entry-repository';
import type { Currency, SpendCategory, SpendEntry } from '@/domain/trip/types';
import { moneyUnchecked } from '@/domain/trip/types';
import type { Db } from '../client';
import { destinations, spendEntries } from '../schema';

function toSpendEntry(row: typeof spendEntries.$inferSelect): SpendEntry {
  return {
    id: row.id,
    destinationId: row.destinationId,
    amount: moneyUnchecked(row.amount, row.currency as Currency),
    category: row.category as SpendCategory,
    description: row.description,
    spentAt: new Date(row.spentAt),
    createdAt: row.createdAt,
  };
}

function toRow(e: SpendEntry): typeof spendEntries.$inferInsert {
  return {
    id: e.id,
    destinationId: e.destinationId,
    amount: e.amount.amountPence,
    currency: e.amount.currency,
    category: e.category,
    description: e.description,
    spentAt: e.spentAt.toISOString().split('T')[0] ?? e.spentAt.toISOString(),
    createdAt: e.createdAt,
  };
}

export class DrizzleSpendEntryRepository implements SpendEntryRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string): Promise<SpendEntry | null> {
    const rows = await this.db.select().from(spendEntries).where(eq(spendEntries.id, id));
    return rows[0] ? toSpendEntry(rows[0]) : null;
  }

  async findByDestination(destinationId: string): Promise<SpendEntry[]> {
    const rows = await this.db
      .select()
      .from(spendEntries)
      .where(eq(spendEntries.destinationId, destinationId))
      .orderBy(spendEntries.spentAt);
    return rows.map(toSpendEntry);
  }

  async findByTrip(tripId: string): Promise<SpendEntry[]> {
    const rows = await this.db
      .select({ spendEntry: spendEntries })
      .from(spendEntries)
      .innerJoin(destinations, eq(spendEntries.destinationId, destinations.id))
      .where(eq(destinations.tripId, tripId))
      .orderBy(spendEntries.spentAt);
    return rows.map((r) => toSpendEntry(r.spendEntry));
  }

  async save(entry: SpendEntry): Promise<SpendEntry> {
    const row = toRow(entry);
    const result = await this.db
      .insert(spendEntries)
      .values(row)
      .onConflictDoUpdate({
        target: spendEntries.id,
        set: {
          amount: row.amount,
          currency: row.currency,
          category: row.category,
          description: row.description,
          spentAt: row.spentAt,
        },
      })
      .returning();
    if (!result[0]) throw new Error('Failed to save spend entry');
    return toSpendEntry(result[0]);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(spendEntries).where(eq(spendEntries.id, id));
  }
}
