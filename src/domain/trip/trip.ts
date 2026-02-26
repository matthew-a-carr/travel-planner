import type { Destination, Money, Result, Trip, TripFixedCost } from './types';
import { err, money, ok } from './types';

/**
 * Sums all fixed costs for a trip (flights, insurance, subscriptions, etc.).
 */
export function calculateTotalFixedCosts(fixedCosts: readonly TripFixedCost[]): Money {
  const totalPence = fixedCosts.reduce((sum, fc) => sum + fc.amount.amountPence, 0);
  // Fixed costs are always GBP for now; default to GBP when list is empty
  const currency = fixedCosts[0]?.amount.currency ?? 'GBP';
  return money(totalPence, currency);
}

/**
 * Calculates the total amount allocated to destinations.
 * Only counts destinations belonging to the given trip.
 */
export function calculateAllocatedBudget(trip: Trip, destinations: readonly Destination[]): Money {
  const tripDestinations = destinations.filter((d) => d.tripId === trip.id);
  const totalPence = tripDestinations.reduce((sum, d) => sum + d.estimatedBudget.amountPence, 0);
  return money(totalPence, trip.totalBudget.currency);
}

/**
 * Calculates the budget available for new destination allocations.
 *
 * available = total − sum(fixedCosts) − sum(destinationAllocations)
 */
export function calculateAvailableBudget(
  trip: Trip,
  destinations: readonly Destination[],
  fixedCosts: readonly TripFixedCost[],
): Money {
  const allocated = calculateAllocatedBudget(trip, destinations);
  const totalFixed = calculateTotalFixedCosts(fixedCosts);
  const availablePence =
    trip.totalBudget.amountPence - totalFixed.amountPence - allocated.amountPence;
  return money(availablePence, trip.totalBudget.currency);
}

/**
 * Determines whether a new budget allocation can be made without
 * violating the invariant: sum(fixedCosts) + allocated + newAllocation ≤ total.
 *
 * Returns Ok(true) if the allocation fits.
 * Returns Err with a descriptive message if it would exceed the budget.
 */
export function canAllocateBudget(
  trip: Trip,
  destinations: readonly Destination[],
  fixedCosts: readonly TripFixedCost[],
  newAllocation: Money,
): Result<true> {
  if (newAllocation.amountPence < 0) {
    return err('Allocation amount must not be negative');
  }

  const available = calculateAvailableBudget(trip, destinations, fixedCosts);

  if (newAllocation.amountPence > available.amountPence) {
    const overBy = newAllocation.amountPence - available.amountPence;
    return err(
      `Allocation of ${newAllocation.amountPence}p exceeds available budget by ${overBy}p`,
    );
  }

  return ok(true);
}

/**
 * Validates that a proposed new total budget for a trip is large enough to
 * cover all existing fixed costs and destination allocations.
 *
 * Called before persisting an edit to prevent the budget from being reduced
 * below what has already been committed to.
 *
 * Returns Ok(true) if the new budget is valid.
 * Returns Err with a descriptive message if existing commitments would exceed it.
 */
export function validateTripBudgetEdit(
  newBudgetPence: number,
  destinations: readonly Destination[],
  fixedCosts: readonly TripFixedCost[],
): Result<true> {
  const totalAllocatedPence = destinations.reduce(
    (sum, d) => sum + d.estimatedBudget.amountPence,
    0,
  );
  const totalFixedPence = fixedCosts.reduce((sum, fc) => sum + fc.amount.amountPence, 0);
  const requiredPence = totalAllocatedPence + totalFixedPence;

  if (newBudgetPence < requiredPence) {
    return err('New budget is too small — reduce fixed costs or destination allocations first');
  }

  return ok(true);
}

/**
 * Returns the next sort order value for a new fixed cost.
 * Mirrors nextSortOrder in destination.ts — kept separate to preserve
 * independent typing for TripFixedCost vs Destination arrays.
 */
export function nextFixedCostSortOrder(fixedCosts: readonly TripFixedCost[]): number {
  if (fixedCosts.length === 0) return 0;
  return Math.max(...fixedCosts.map((fc) => fc.sortOrder)) + 1;
}

/**
 * Returns a summary of the trip budget state.
 */
export function getTripBudgetSummary(
  trip: Trip,
  destinations: readonly Destination[],
  fixedCosts: readonly TripFixedCost[],
) {
  const totalFixed = calculateTotalFixedCosts(fixedCosts);
  const allocated = calculateAllocatedBudget(trip, destinations);
  const available = calculateAvailableBudget(trip, destinations, fixedCosts);

  return {
    total: trip.totalBudget,
    fixedCosts,
    totalFixed,
    allocated,
    available,
    isOverAllocated: available.amountPence < 0,
    allocationPercentage:
      trip.totalBudget.amountPence > 0
        ? Math.round(
            ((allocated.amountPence + totalFixed.amountPence) / trip.totalBudget.amountPence) * 100,
          )
        : 0,
  };
}
