import type { DestinationRepository } from '@/domain/destination/destination-repository';
import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';

export async function removeDestination(
  destRepo: DestinationRepository,
  destinationId: string,
): Promise<Result<true>> {
  const destination = await destRepo.findById(destinationId);
  if (!destination) return err(`Destination not found: ${destinationId}`);

  await destRepo.delete(destinationId);
  return ok(true);
}
