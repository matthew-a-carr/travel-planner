import type { TripRepository } from '@/domain/trip/trip-repository';
import type { Currency, Result, Trip, TripStatus } from '@/domain/trip/types';
import { err, money, ok } from '@/domain/trip/types';

export type CreateTripInput = {
  organizationId: string;
  ownerId: string;
  name: string;
  totalBudgetPence: number;
  currency: Currency;
};

export async function createTrip(
  repo: TripRepository,
  input: CreateTripInput,
): Promise<Result<Trip>> {
  const now = new Date();
  const status: TripStatus = 'planning';

  const budgetResult = money(input.totalBudgetPence, input.currency);
  if (!budgetResult.ok) return err(budgetResult.error);

  const trip: Trip = {
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    ownerId: input.ownerId,
    name: input.name,
    totalBudget: budgetResult.value,
    status,
    createdAt: now,
    updatedAt: now,
  };

  const saved = await repo.save(trip);
  return ok(saved);
}
