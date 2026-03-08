import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';
import type { Currency, FixedCostCategory, Result, TripFixedCost } from '@/domain/trip/types';
import { err, money, ok } from '@/domain/trip/types';

export type EditFixedCostInput = {
  fixedCostId: string;
  label: string;
  amountPence: number;
  currency: Currency;
  category: FixedCostCategory;
  date: Date;
};

export async function editFixedCost(
  fixedCostRepo: TripFixedCostRepository,
  input: EditFixedCostInput,
): Promise<Result<TripFixedCost>> {
  if (input.amountPence <= 0) {
    return err('Amount must be greater than zero');
  }

  const existing = await fixedCostRepo.findById(input.fixedCostId);
  if (!existing) return err(`Fixed cost not found: ${input.fixedCostId}`);

  const updated: TripFixedCost = {
    ...existing,
    label: input.label,
    amount: money(input.amountPence, input.currency),
    category: input.category,
    date: input.date,
  };

  const saved = await fixedCostRepo.save(updated);
  return ok(saved);
}
