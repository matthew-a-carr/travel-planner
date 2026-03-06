import type { TripRepository } from '@/domain/trip/trip-repository';
import type { Currency, Trip, TripStatus } from '@/domain/trip/types';
import { money } from '@/domain/trip/types';

export type CreateTripInput = {
  organizationId: string;
  ownerId: string;
  name: string;
  totalBudgetPence: number;
  currency: Currency;
};

export async function createTrip(repo: TripRepository, input: CreateTripInput): Promise<Trip> {
  const now = new Date();
  const status: TripStatus = 'planning';

  const trip: Trip = {
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    ownerId: input.ownerId,
    name: input.name,
    totalBudget: money(input.totalBudgetPence, input.currency),
    status,
    createdAt: now,
    updatedAt: now,
  };

  return repo.save(trip);
}
