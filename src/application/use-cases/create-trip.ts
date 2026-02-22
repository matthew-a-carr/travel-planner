import type { TripRepository } from '@/domain/trip/trip-repository';
import type { Currency, Trip, TripStatus } from '@/domain/trip/types';
import { money } from '@/domain/trip/types';

export type CreateTripInput = {
  ownerId: string;
  name: string;
  totalBudgetPence: number;
  currency: Currency;
  ringfencedAmountPence: number;
  ringfencedLabel: string | null;
};

export async function createTrip(repo: TripRepository, input: CreateTripInput): Promise<Trip> {
  const now = new Date();
  const status: TripStatus = 'planning';

  const trip: Trip = {
    id: crypto.randomUUID(),
    ownerId: input.ownerId,
    name: input.name,
    totalBudget: money(input.totalBudgetPence, input.currency),
    ringfencedAmount: money(input.ringfencedAmountPence, input.currency),
    ringfencedLabel: input.ringfencedLabel,
    status,
    createdAt: now,
    updatedAt: now,
  };

  return repo.save(trip);
}
