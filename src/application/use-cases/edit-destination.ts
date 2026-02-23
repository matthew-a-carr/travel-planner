import { validateDestinationEdit } from '@/domain/destination/destination';
import type { DestinationRepository } from '@/domain/destination/destination-repository';
import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { ComfortLevel, Currency, Destination, Result } from '@/domain/trip/types';
import { err, money, ok } from '@/domain/trip/types';

export type EditDestinationInput = {
  destinationId: string;
  tripId: string;
  name: string;
  country: string;
  estimatedBudgetPence: number;
  currency: Currency;
  comfortLevel: ComfortLevel;
  startDate: Date | null;
  endDate: Date | null;
};

export async function editDestination(
  tripRepo: TripRepository,
  destRepo: DestinationRepository,
  fixedCostRepo: TripFixedCostRepository,
  input: EditDestinationInput,
): Promise<Result<Destination>> {
  const existing = await destRepo.findById(input.destinationId);
  if (!existing) return err(`Destination not found: ${input.destinationId}`);
  if (existing.tripId !== input.tripId) return err('Destination does not belong to this trip');

  const trip = await tripRepo.findById(input.tripId);
  if (!trip) return err('Trip not found');

  const [allDestinations, fixedCosts] = await Promise.all([
    destRepo.findByTrip(input.tripId),
    fixedCostRepo.findByTrip(input.tripId),
  ]);

  const updated: Destination = {
    ...existing,
    name: input.name,
    country: input.country,
    estimatedBudget: money(input.estimatedBudgetPence, input.currency),
    comfortLevel: input.comfortLevel,
    startDate: input.startDate,
    endDate: input.endDate,
    updatedAt: new Date(),
  };

  const validation = validateDestinationEdit(trip, allDestinations, fixedCosts, existing, updated);
  if (!validation.ok) return err(validation.error);

  const saved = await destRepo.save(updated);
  return ok(saved);
}
