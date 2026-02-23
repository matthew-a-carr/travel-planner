import type { SpendEntryRepository } from '@/domain/spending/spend-entry-repository';
import type { Currency, Result, SpendCategory, SpendEntry } from '@/domain/trip/types';
import { err, money, ok } from '@/domain/trip/types';

export type EditSpendEntryInput = {
  entryId: string;
  amountPence: number;
  currency: Currency;
  category: SpendCategory;
  description: string | null;
  spentAt: Date;
};

export async function editSpendEntry(
  spendRepo: SpendEntryRepository,
  input: EditSpendEntryInput,
): Promise<Result<SpendEntry>> {
  if (input.amountPence <= 0) {
    return err('Spend amount must be greater than zero');
  }

  const existing = await spendRepo.findById(input.entryId);
  if (!existing) return err(`Spend entry not found: ${input.entryId}`);

  const updated: SpendEntry = {
    ...existing,
    amount: money(input.amountPence, input.currency),
    category: input.category,
    description: input.description,
    spentAt: input.spentAt,
  };

  const saved = await spendRepo.save(updated);
  return ok(saved);
}
