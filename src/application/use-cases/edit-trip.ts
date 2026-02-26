import type { DestinationRepository } from '@/domain/destination/destination-repository';
import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';
import { validateTripBudgetEdit } from '@/domain/trip/trip';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { Currency, Result, Trip, TripStatus } from '@/domain/trip/types';
import { err, money, ok } from '@/domain/trip/types';

export type EditTripInput = {
  tripId: string;
  name: string;
  totalBudgetPence: number;
  currency: Currency;
  status: TripStatus;
};

export async function editTrip(
  tripRepo: TripRepository,
  destRepo: DestinationRepository,
  fixedCostRepo: TripFixedCostRepository,
  input: EditTripInput,
): Promise<Result<Trip>> {
  const existing = await tripRepo.findById(input.tripId);
  if (!existing) return err(`Trip not found: ${input.tripId}`);

  const [destinations, fixedCosts] = await Promise.all([
    destRepo.findByTrip(input.tripId),
    fixedCostRepo.findByTrip(input.tripId),
  ]);

  const validation = validateTripBudgetEdit(input.totalBudgetPence, destinations, fixedCosts);
  if (!validation.ok) return err(validation.error);

  const updated: Trip = {
    ...existing,
    name: input.name,
    totalBudget: money(input.totalBudgetPence, input.currency),
    status: input.status,
    updatedAt: new Date(),
  };

  const saved = await tripRepo.save(updated);
  return ok(saved);
}
