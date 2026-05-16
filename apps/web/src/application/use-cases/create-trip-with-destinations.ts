import type { DestinationRepository } from '@/domain/destination/destination-repository';
import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { Currency, Destination, Trip } from '@/domain/trip/types';
import type { BulkAddRowError, BulkDestinationCandidate } from './bulk-add-destinations';
import { bulkAddDestinations } from './bulk-add-destinations';
import { createTrip } from './create-trip';

export type CreateTripWithDestinationsInput = {
  readonly organizationId: string;
  readonly ownerId: string;
  readonly name: string;
  readonly totalBudgetPence: number;
  readonly currency: Currency;
  readonly candidates: readonly BulkDestinationCandidate[];
};

export type CreateTripWithDestinationsOutcome =
  | {
      readonly ok: true;
      readonly trip: Trip;
      readonly savedDestinations: readonly Destination[];
    }
  | {
      readonly ok: false;
      readonly error: string;
      readonly bulkErrors?: readonly BulkAddRowError[];
    };

/**
 * Creates a trip and bulk-adds destinations in one orchestrated step.
 *
 * On bulk-add failure we compensate by deleting the trip we just created
 * so the user isn't left with an orphan empty trip from a half-successful
 * paste-to-create flow. Drizzle gives us no cross-call transaction here,
 * so this compensating delete is the closest thing to atomicity available
 * at this layer.
 */
export async function createTripWithDestinations(
  tripRepo: TripRepository,
  destRepo: DestinationRepository,
  fixedCostRepo: TripFixedCostRepository,
  input: CreateTripWithDestinationsInput,
): Promise<CreateTripWithDestinationsOutcome> {
  const tripResult = await createTrip(tripRepo, {
    organizationId: input.organizationId,
    ownerId: input.ownerId,
    name: input.name,
    totalBudgetPence: input.totalBudgetPence,
    currency: input.currency,
  });
  if (!tripResult.ok) {
    return { ok: false, error: tripResult.error };
  }

  if (input.candidates.length === 0) {
    return { ok: true, trip: tripResult.value, savedDestinations: [] };
  }

  const bulkResult = await bulkAddDestinations(
    tripRepo,
    destRepo,
    fixedCostRepo,
    tripResult.value.id,
    input.candidates,
  );

  if (!bulkResult.ok) {
    await tripRepo.delete(tripResult.value.id);
    return {
      ok: false,
      error: 'Could not add destinations — the trip was rolled back.',
      bulkErrors: bulkResult.errors,
    };
  }

  return {
    ok: true,
    trip: tripResult.value,
    savedDestinations: bulkResult.saved,
  };
}
