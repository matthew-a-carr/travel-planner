import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { Trip } from '@/domain/trip/types';

export async function findAccessibleTrip(
  tripRepository: TripRepository,
  organizationRepository: OrganizationRepository,
  userId: string,
  tripId: string,
): Promise<Trip | null> {
  const trip = await tripRepository.findById(tripId);
  if (!trip) return null;
  const membership = await organizationRepository.findMembership(trip.organizationId, userId);
  return membership ? trip : null;
}

export function fromIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
