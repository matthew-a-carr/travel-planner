import { canMoveTripsBetweenOrganizations } from '@/domain/organization/organization';
import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { Result, Trip } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';

export type MoveTripToOrganizationInput = {
  readonly actorUserId: string;
  readonly tripId: string;
  readonly targetOrganizationId: string;
};

export async function moveTripToOrganization(
  tripRepository: TripRepository,
  organizationRepository: OrganizationRepository,
  input: MoveTripToOrganizationInput,
): Promise<Result<Trip>> {
  const trip = await tripRepository.findById(input.tripId);
  if (!trip) return err('Trip not found');

  if (trip.organizationId === input.targetOrganizationId) {
    return err('Trip already belongs to that organization');
  }

  const sourceMembership = await organizationRepository.findMembership(
    trip.organizationId,
    input.actorUserId,
  );
  if (!sourceMembership || !canMoveTripsBetweenOrganizations(sourceMembership.role)) {
    return err('Forbidden');
  }

  const targetMembership = await organizationRepository.findMembership(
    input.targetOrganizationId,
    input.actorUserId,
  );
  if (!targetMembership || !canMoveTripsBetweenOrganizations(targetMembership.role)) {
    return err('Forbidden');
  }

  const moved = await tripRepository.save({
    ...trip,
    organizationId: input.targetOrganizationId,
    updatedAt: new Date(),
  });
  return ok(moved);
}
