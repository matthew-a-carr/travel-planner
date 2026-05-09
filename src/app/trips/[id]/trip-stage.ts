import type { Destination, SpendEntry, Trip, TripFixedCost } from '@/domain/trip/types';

export type TripStage = 'empty' | 'planning' | 'active' | 'completed';

export function getTripStage(
  trip: Pick<Trip, 'status'>,
  destinations: readonly Destination[],
  fixedCosts: readonly TripFixedCost[],
  allSpend: readonly SpendEntry[],
): TripStage {
  if (trip.status === 'completed') return 'completed';
  if (trip.status === 'active' || allSpend.length > 0) return 'active';
  if (destinations.length === 0 && fixedCosts.length === 0) return 'empty';
  return 'planning';
}

export function hasTwoOrMoreDatedDestinations(destinations: readonly Destination[]): boolean {
  let count = 0;
  for (const d of destinations) {
    if (d.startDate && d.endDate) {
      count += 1;
      if (count >= 2) return true;
    }
  }
  return false;
}
