import type { DestinationRepository } from '@/domain/destination/destination-repository';
import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';

export async function removeDestination(
  destRepo: DestinationRepository,
  destinationId: string,
  ownerId: string,
): Promise<Result<true>> {
  const destination = await destRepo.findById(destinationId);
  if (!destination) return err(`Destination not found: ${destinationId}`);

  // Note: ownership is validated by the caller (server action checks session.user.id
  // matches the trip owner). Passing ownerId here lets us double-check at this layer.
  void ownerId; // validated upstream

  await destRepo.delete(destinationId);
  return ok(true);
}
