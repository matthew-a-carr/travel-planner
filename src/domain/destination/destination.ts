import { canAllocateBudget } from '../trip/trip';
import type { Coordinates, Destination, Result, Trip, TripFixedCost } from '../trip/types';
import { err, money, ok } from '../trip/types';

/**
 * Validates geographic coordinates for map pinning.
 * Latitude must be in [-90, 90], longitude in [-180, 180].
 */
export function validateCoordinates(lat: number, lng: number): Result<Coordinates> {
  if (lat < -90 || lat > 90) return err('Latitude must be between -90 and 90');
  if (lng < -180 || lng > 180) return err('Longitude must be between -180 and 180');
  return ok({ latitude: lat, longitude: lng });
}

/**
 * Validates that a destination's date range is coherent.
 * Both dates must be provided together, and start must be before end.
 */
export function validateDateRange(
  destination: Pick<Destination, 'startDate' | 'endDate'>,
): Result<true> {
  const { startDate, endDate } = destination;

  if (startDate === null && endDate === null) return ok(true);

  if (startDate !== null && endDate === null) {
    return err('End date is required when start date is set');
  }

  if (startDate === null && endDate !== null) {
    return err('Start date is required when end date is set');
  }

  if (startDate !== null && endDate !== null && startDate >= endDate) {
    return err('Start date must be before end date');
  }

  return ok(true);
}

/**
 * Returns destinations sorted by their sort_order, then creation date.
 */
export function sortDestinations(destinations: readonly Destination[]): Destination[] {
  return [...destinations].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

/**
 * Validates that a new destination can be added to the trip without
 * violating the budget invariant: sum(fixedCosts) + allocated + newAllocation ≤ total.
 *
 * Returns Ok(destination) if valid, Err with reason if not.
 */
export function validateNewDestination(
  trip: Trip,
  existingDestinations: readonly Destination[],
  fixedCosts: readonly TripFixedCost[],
  destination: Destination,
): Result<Destination> {
  const dateCheck = validateDateRange(destination);
  if (!dateCheck.ok) return err(dateCheck.error);

  const budgetCheck = canAllocateBudget(
    trip,
    existingDestinations,
    fixedCosts,
    destination.estimatedBudget,
  );
  if (!budgetCheck.ok) return err(budgetCheck.error);

  return ok(destination);
}

/**
 * Calculates the number of days for a destination based on its start and end dates.
 *
 * Returns null if either date is missing — callers should treat null as "unknown duration".
 * Duration feeds the budget suggestion engine and future burndown visualisation.
 */
export function destinationDays(
  destination: Pick<Destination, 'startDate' | 'endDate'>,
): number | null {
  const { startDate, endDate } = destination;
  if (!startDate || !endDate) return null;
  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Validates that an edited destination does not violate the trip's budget invariant.
 *
 * Uses a delta approach: only a budget *increase* consumes additional headroom.
 * The delta (newBudget − existingBudget) is passed to canAllocateBudget alongside
 * allDestinations (which still contains the existing allocation at its current value),
 * so the maths cancel correctly without any exclusion logic:
 *
 *   available = total − fixed − sum(allDests)         [existing alloc already included]
 *   check:      delta ≤ available
 *   ↔           newBudget ≤ total − fixed − sum(otherDests)  ✓
 *
 * A budget decrease (delta ≤ 0) always passes — the allocation is shrinking.
 */
export function validateDestinationEdit(
  trip: Trip,
  allDestinations: readonly Destination[],
  fixedCosts: readonly TripFixedCost[],
  existing: Destination,
  updated: Destination,
): Result<Destination> {
  const dateCheck = validateDateRange(updated);
  if (!dateCheck.ok) return err(dateCheck.error);

  const deltaPence = updated.estimatedBudget.amountPence - existing.estimatedBudget.amountPence;

  if (deltaPence > 0) {
    const budgetCheck = canAllocateBudget(
      trip,
      allDestinations,
      fixedCosts,
      money(deltaPence, updated.estimatedBudget.currency),
    );
    if (!budgetCheck.ok) return err(budgetCheck.error);
  }

  return ok(updated);
}

/**
 * Returns the next sort order value for a new destination.
 */
export function nextSortOrder(destinations: readonly Destination[]): number {
  if (destinations.length === 0) return 0;
  return Math.max(...destinations.map((d) => d.sortOrder)) + 1;
}
