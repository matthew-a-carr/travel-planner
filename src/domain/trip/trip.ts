import type { Trip, Destination, Money, Result } from './types';
import { ok, err, money } from './types';

/**
 * Calculates the total amount allocated to destinations.
 * Only counts destinations belonging to the given trip.
 */
export function calculateAllocatedBudget(
  trip: Trip,
  destinations: readonly Destination[],
): Money {
  const tripDestinations = destinations.filter((d) => d.tripId === trip.id);
  const totalPence = tripDestinations.reduce(
    (sum, d) => sum + d.estimatedBudget.amountPence,
    0,
  );
  return money(totalPence, trip.totalBudget.currency);
}

/**
 * Calculates the budget available for new destination allocations.
 *
 * available = total - ringfenced - allocated
 *
 * The ringfenced amount is a hard reservation and is never available
 * for destination allocation.
 */
export function calculateAvailableBudget(
  trip: Trip,
  destinations: readonly Destination[],
): Money {
  const allocated = calculateAllocatedBudget(trip, destinations);
  const availablePence =
    trip.totalBudget.amountPence -
    trip.ringfencedAmount.amountPence -
    allocated.amountPence;
  return money(availablePence, trip.totalBudget.currency);
}

/**
 * Determines whether a new budget allocation can be made without
 * violating the invariant: allocated + ringfenced <= total.
 *
 * Returns Ok(true) if the allocation fits.
 * Returns Err with a descriptive message if it would exceed the budget.
 */
export function canAllocateBudget(
  trip: Trip,
  destinations: readonly Destination[],
  newAllocation: Money,
): Result<true> {
  if (newAllocation.amountPence < 0) {
    return err('Allocation amount must not be negative');
  }

  const available = calculateAvailableBudget(trip, destinations);

  if (newAllocation.amountPence > available.amountPence) {
    const overBy = newAllocation.amountPence - available.amountPence;
    return err(
      `Allocation of ${newAllocation.amountPence}p exceeds available budget by ${overBy}p`,
    );
  }

  return ok(true);
}

/**
 * Returns a summary of the trip budget state.
 */
export function getTripBudgetSummary(
  trip: Trip,
  destinations: readonly Destination[],
) {
  const allocated = calculateAllocatedBudget(trip, destinations);
  const available = calculateAvailableBudget(trip, destinations);

  return {
    total: trip.totalBudget,
    ringfenced: trip.ringfencedAmount,
    allocated,
    available,
    isOverAllocated: available.amountPence < 0,
    allocationPercentage:
      trip.totalBudget.amountPence > 0
        ? Math.round(
            ((allocated.amountPence + trip.ringfencedAmount.amountPence) /
              trip.totalBudget.amountPence) *
              100,
          )
        : 0,
  };
}
