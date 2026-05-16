import type { DestinationRepository } from '@/domain/destination/destination-repository';
import type { SpendEntryRepository } from '@/domain/spending/spend-entry-repository';
import type { Currency, Result, SpendCategory, SpendEntry } from '@/domain/trip/types';
import { err, money, ok } from '@/domain/trip/types';

export type RecordSpendInput = {
  destinationId: string;
  amountPence: number;
  currency: Currency;
  category: SpendCategory;
  description: string | null;
  spentAt: Date;
};

export async function recordSpend(
  destRepo: DestinationRepository,
  spendRepo: SpendEntryRepository,
  input: RecordSpendInput,
): Promise<Result<SpendEntry>> {
  if (input.amountPence <= 0) {
    return err('Spend amount must be greater than zero');
  }

  const destination = await destRepo.findById(input.destinationId);
  if (!destination) return err(`Destination not found: ${input.destinationId}`);

  const amountResult = money(input.amountPence, input.currency);
  if (!amountResult.ok) return err(amountResult.error);

  const entry: SpendEntry = {
    id: crypto.randomUUID(),
    destinationId: input.destinationId,
    amount: amountResult.value,
    category: input.category,
    description: input.description,
    spentAt: input.spentAt,
    createdAt: new Date(),
  };

  const saved = await spendRepo.save(entry);
  return ok(saved);
}
