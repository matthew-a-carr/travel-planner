import { canDeleteTrips } from '@/domain/organization/organization';
import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';

export type DeleteTripInput = {
  readonly actorUserId: string;
  readonly tripId: string;
};

export async function deleteTrip(
  tripRepository: TripRepository,
  organizationRepository: OrganizationRepository,
  input: DeleteTripInput,
): Promise<Result<void>> {
  const trip = await tripRepository.findById(input.tripId);
  if (!trip) return err('Trip not found');

  const membership = await organizationRepository.findMembership(
    trip.organizationId,
    input.actorUserId,
  );
  if (!membership) return err('Forbidden');
  if (!canDeleteTrips(membership.role)) return err('Forbidden');

  await tripRepository.delete(trip.id);
  return ok(undefined);
}
