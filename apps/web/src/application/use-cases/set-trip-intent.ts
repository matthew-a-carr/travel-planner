import type { TripRepository } from '@/domain/trip/trip-repository';
import type { Result, TripIntent } from '@/domain/trip/types';
import { err, isTripIntent, ok } from '@/domain/trip/types';

export type SetTripIntentInput = {
  readonly tripId: string;
  readonly intent: string;
};

/**
 * Persist a trip's visa intent (tourism / working-holiday / long-stay). Rejects
 * an unknown intent or a missing trip; returns the saved intent on success.
 */
export async function setTripIntent(
  repo: TripRepository,
  input: SetTripIntentInput,
): Promise<Result<TripIntent>> {
  if (!isTripIntent(input.intent)) return err(`Invalid trip intent: ${input.intent}`);

  const existing = await repo.getIntent(input.tripId);
  if (existing === null) return err(`Trip not found: ${input.tripId}`);

  await repo.setIntent(input.tripId, input.intent);
  return ok(input.intent);
}
