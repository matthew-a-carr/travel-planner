import { nextSortOrder, validateNewDestination } from '@/domain/destination/destination';
import type { DestinationRepository } from '@/domain/destination/destination-repository';
import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { ComfortLevel, Currency, Destination, Result } from '@/domain/trip/types';
import { err, money, ok } from '@/domain/trip/types';

export type AddDestinationInput = {
  tripId: string;
  name: string;
  country: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  estimatedBudgetPence: number;
  currency: Currency;
  comfortLevel: ComfortLevel;
  startDate: Date | null;
  endDate: Date | null;
};

export async function addDestination(
  tripRepo: TripRepository,
  destRepo: DestinationRepository,
  fixedCostRepo: TripFixedCostRepository,
  input: AddDestinationInput,
): Promise<Result<Destination>> {
  const trip = await tripRepo.findById(input.tripId);
  if (!trip) return err(`Trip not found: ${input.tripId}`);

  const [existing, fixedCosts] = await Promise.all([
    destRepo.findByTrip(input.tripId),
    fixedCostRepo.findByTrip(input.tripId),
  ]);

  const now = new Date();
  const candidate: Destination = {
    id: crypto.randomUUID(),
    tripId: input.tripId,
    name: input.name,
    country: input.country,
    city: input.city,
    latitude: input.latitude,
    longitude: input.longitude,
    estimatedBudget: money(input.estimatedBudgetPence, input.currency),
    comfortLevel: input.comfortLevel,
    startDate: input.startDate,
    endDate: input.endDate,
    sortOrder: nextSortOrder(existing),
    createdAt: now,
    updatedAt: now,
  };

  const validation = validateNewDestination(trip, existing, fixedCosts, candidate);
  if (!validation.ok) return err(validation.error);

  const saved = await destRepo.save(candidate);
  return ok(saved);
}
