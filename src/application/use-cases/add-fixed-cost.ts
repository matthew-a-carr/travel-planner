import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { Currency, Result, TripFixedCost } from '@/domain/trip/types';
import { err, money, ok } from '@/domain/trip/types';

export type AddFixedCostInput = {
  tripId: string;
  label: string;
  amountPence: number;
  currency: Currency;
};

export async function addFixedCost(
  tripRepo: TripRepository,
  fixedCostRepo: TripFixedCostRepository,
  input: AddFixedCostInput,
): Promise<Result<TripFixedCost>> {
  const trip = await tripRepo.findById(input.tripId);
  if (!trip) return err(`Trip not found: ${input.tripId}`);

  const existing = await fixedCostRepo.findByTrip(input.tripId);
  const nextSortOrder =
    existing.length === 0 ? 0 : Math.max(...existing.map((fc) => fc.sortOrder)) + 1;

  const fixedCost: TripFixedCost = {
    id: crypto.randomUUID(),
    tripId: input.tripId,
    label: input.label,
    amount: money(input.amountPence, input.currency),
    sortOrder: nextSortOrder,
    createdAt: new Date(),
  };

  const saved = await fixedCostRepo.save(fixedCost);
  return ok(saved);
}
