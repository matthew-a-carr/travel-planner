import type { TripSummary } from '@travel-planner/shared';
import type { DestinationRepository } from '@/domain/destination/destination-repository';
import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { Destination, Trip } from '@/domain/trip/types';
import { earliestIsoDate, latestIsoDate, toWireMoney } from './trip-wire-mapping';

/**
 * Trips visible to a user across every organisation they belong to
 * (SPEC-009): org-scoped visibility reuses `findOrganizationsForUser` —
 * the same membership rule the web session uses. Destinations are read
 * in one batch (`findByTrips`) purely to derive each trip's date range;
 * destination rows never reach the wire.
 */
export async function listTripsForUser(
  organizationRepository: OrganizationRepository,
  tripRepository: TripRepository,
  destinationRepository: DestinationRepository,
  userId: string,
): Promise<TripSummary[]> {
  const organizations = await organizationRepository.findOrganizationsForUser(userId);
  const tripsPerOrg = await Promise.all(
    organizations.map(({ organization }) => tripRepository.findAllByOrganization(organization.id)),
  );
  const trips = tripsPerOrg.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const destinations = await destinationRepository.findByTrips(trips.map((t) => t.id));
  const destinationsByTrip = new Map<string, Destination[]>();
  for (const destination of destinations) {
    const group = destinationsByTrip.get(destination.tripId);
    if (group) {
      group.push(destination);
    } else {
      destinationsByTrip.set(destination.tripId, [destination]);
    }
  }

  return trips.map((trip) => toTripSummary(trip, destinationsByTrip.get(trip.id) ?? []));
}

function toTripSummary(trip: Trip, destinations: Destination[]): TripSummary {
  return {
    id: trip.id,
    name: trip.name,
    status: trip.status,
    totalBudget: toWireMoney(trip.totalBudget),
    startDate: earliestIsoDate(destinations.map((d) => d.startDate)),
    endDate: latestIsoDate(destinations.map((d) => d.endDate)),
    organizationId: trip.organizationId,
    updatedAt: trip.updatedAt.toISOString(),
  };
}
