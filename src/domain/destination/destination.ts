import { canAllocateBudget } from '../trip/trip';
import type { Destination, Result, Trip, TripFixedCost } from '../trip/types';
import { err, ok } from '../trip/types';
import type {} from './types';

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
 * Returns the next sort order value for a new destination.
 */
export function nextSortOrder(destinations: readonly Destination[]): number {
  if (destinations.length === 0) return 0;
  return Math.max(...destinations.map((d) => d.sortOrder)) + 1;
}
