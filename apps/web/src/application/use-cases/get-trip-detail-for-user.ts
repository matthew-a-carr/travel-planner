import type {
  TripDestination as WireTripDestination,
  TripDetail as WireTripDetail,
  TripFixedCost as WireTripFixedCost,
} from '@travel-planner/shared';
import type { DestinationRepository } from '@/domain/destination/destination-repository';
import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import { calculateTotalSpend } from '@/domain/spending/spend-entry';
import type { SpendEntryRepository } from '@/domain/spending/spend-entry-repository';
import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';
import { getTripBudgetSummary } from '@/domain/trip/trip';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { Destination, Money, SpendEntry, TripFixedCost } from '@/domain/trip/types';
import { earliestIsoDate, latestIsoDate, toIsoDate, toWireMoney } from './trip-wire-mapping';

/**
 * Composite trip detail for the v1 read surface (SPEC-010): the trip, its
 * timeline legs (destinations + per-destination spend), committed fixed
 * costs, and the same budget summary the web detail page derives.
 *
 * Returns `null` when the trip doesn't exist OR the caller isn't a member
 * of its organisation — the route answers 404 either way (non-revealing,
 * the web's `notFound()` rule).
 */
export async function getTripDetailForUser(
  organizationRepository: OrganizationRepository,
  tripRepository: TripRepository,
  destinationRepository: DestinationRepository,
  tripFixedCostRepository: TripFixedCostRepository,
  spendEntryRepository: SpendEntryRepository,
  userId: string,
  tripId: string,
): Promise<WireTripDetail | null> {
  const trip = await tripRepository.findById(tripId);
  if (!trip) return null;

  const membership = await organizationRepository.findMembership(trip.organizationId, userId);
  if (!membership) return null;

  const [destinations, fixedCosts, spendEntries] = await Promise.all([
    destinationRepository.findByTrip(tripId),
    tripFixedCostRepository.findByTrip(tripId),
    spendEntryRepository.findByTrip(tripId),
  ]);

  const budget = getTripBudgetSummary(trip, destinations, fixedCosts);
  const spentByDestination = groupSpendByDestination(spendEntries);

  return {
    id: trip.id,
    name: trip.name,
    status: trip.status,
    totalBudget: toWireMoney(trip.totalBudget),
    startDate: earliestIsoDate(destinations.map((d) => d.startDate)),
    endDate: latestIsoDate(destinations.map((d) => d.endDate)),
    organizationId: trip.organizationId,
    updatedAt: trip.updatedAt.toISOString(),
    destinations: destinations.map((destination) =>
      toWireDestination(destination, spentByDestination.get(destination.id) ?? []),
    ),
    fixedCosts: fixedCosts.map(toWireFixedCost),
    spend: {
      totalBudget: toWireMoney(budget.total),
      fixedCosts: toWireMoney(budget.totalFixed),
      allocated: toWireMoney(budget.allocated),
      available: toWireMoney(budget.available),
      spent: toWireMoney(totalSpendOrThrow(spendEntries)),
      isOverAllocated: budget.isOverAllocated,
    },
  };
}

function toWireDestination(destination: Destination, spend: SpendEntry[]): WireTripDestination {
  return {
    id: destination.id,
    name: destination.name,
    country: destination.country,
    city: destination.city,
    startDate: toIsoDate(destination.startDate),
    endDate: toIsoDate(destination.endDate),
    estimatedBudget: toWireMoney(destination.estimatedBudget),
    comfortLevel: destination.comfortLevel,
    sortOrder: destination.sortOrder,
    spent: toWireMoney(totalSpendOrThrow(spend)),
  };
}

function toWireFixedCost(fixedCost: TripFixedCost): WireTripFixedCost {
  return {
    id: fixedCost.id,
    label: fixedCost.label,
    amount: toWireMoney(fixedCost.amount),
    category: fixedCost.category,
    // date is non-null in the domain; the wire format is YYYY-MM-DD.
    date: toIsoDate(fixedCost.date) as string,
    sortOrder: fixedCost.sortOrder,
  };
}

function groupSpendByDestination(entries: SpendEntry[]): Map<string, SpendEntry[]> {
  const groups = new Map<string, SpendEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.destinationId);
    if (group) {
      group.push(entry);
    } else {
      groups.set(entry.destinationId, [entry]);
    }
  }
  return groups;
}

/**
 * Mixed-currency spend is impossible under ADR 011 (GBP-only data); if it
 * ever happens, fail loud (the route answers 500) rather than mis-sum.
 */
function totalSpendOrThrow(entries: readonly SpendEntry[]): Money {
  const total = calculateTotalSpend(entries);
  if (!total.ok) throw new Error(`getTripDetailForUser: ${total.error}`);
  return total.value;
}
