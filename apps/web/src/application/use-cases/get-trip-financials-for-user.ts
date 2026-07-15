import type {
  TripFinancials,
  WireBurndownProjection,
  WireSpendEntry,
} from '@travel-planner/shared';
import type { DestinationRepository } from '@/domain/destination/destination-repository';
import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import {
  type BurndownProjection,
  calculateTripBurndown,
  detectAlerts,
} from '@/domain/spending/burndown';
import { calculateTotalSpend, groupByCategory } from '@/domain/spending/spend-entry';
import type { SpendEntryRepository } from '@/domain/spending/spend-entry-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { SpendEntry } from '@/domain/trip/types';
import { toIsoDate, toWireMoney } from './trip-wire-mapping';

export async function getTripFinancialsForUser(
  organizationRepository: OrganizationRepository,
  tripRepository: TripRepository,
  destinationRepository: DestinationRepository,
  spendEntryRepository: SpendEntryRepository,
  userId: string,
  tripId: string,
  currentDate: Date,
): Promise<TripFinancials | null> {
  const trip = await tripRepository.findById(tripId);
  if (!trip) return null;
  if (!(await organizationRepository.findMembership(trip.organizationId, userId))) return null;

  const [destinations, entries] = await Promise.all([
    destinationRepository.findByTrip(tripId),
    spendEntryRepository.findByTrip(tripId),
  ]);
  const burndown = calculateTripBurndown(destinations, entries, currentDate);
  const latestEndDate = latestDate(destinations.map((destination) => destination.endDate));

  return {
    entries: [...entries].sort(compareEntriesNewestFirst).map(toWireSpendEntry),
    categoryTotals: [...groupByCategory(entries).entries()]
      .map(([category, categoryEntries]) => ({
        category: categoryEntries[0]?.category ?? (category as SpendEntry['category']),
        amountPence: totalPenceOrThrow(categoryEntries),
      }))
      .sort((a, b) => b.amountPence - a.amountPence || a.category.localeCompare(b.category)),
    burndown: burndown ? toWireBurndown(burndown) : null,
    alerts: burndown && latestEndDate ? detectAlerts(burndown, entries, latestEndDate) : [],
  };
}

export function toWireSpendEntry(entry: SpendEntry): WireSpendEntry {
  return {
    id: entry.id,
    destinationId: entry.destinationId,
    amount: toWireMoney(entry.amount),
    category: entry.category,
    description: entry.description,
    spentAt: toIsoDate(entry.spentAt) as string,
    createdAt: entry.createdAt.toISOString(),
  };
}

function toWireBurndown(projection: BurndownProjection): WireBurndownProjection {
  const mapLine = (line: BurndownProjection['idealLine']) =>
    line.map((point) => ({
      date: toIsoDate(point.date) as string,
      amountPence: point.amountPence,
    }));
  return {
    idealLine: mapLine(projection.idealLine),
    actualLine: mapLine(projection.actualLine),
    projectedLine: mapLine(projection.projectedLine),
    dailyPacePence: projection.dailyPacePence,
    targetPacePence: projection.targetPacePence,
    paceRatio: projection.paceRatio,
    projectedExhaustionDate: toIsoDate(projection.projectedExhaustionDate),
  };
}

function compareEntriesNewestFirst(a: SpendEntry, b: SpendEntry): number {
  return (
    b.spentAt.getTime() - a.spentAt.getTime() ||
    b.createdAt.getTime() - a.createdAt.getTime() ||
    b.id.localeCompare(a.id)
  );
}

function totalPenceOrThrow(entries: readonly SpendEntry[]): number {
  const total = calculateTotalSpend(entries);
  if (!total.ok) throw new Error(`getTripFinancialsForUser: ${total.error}`);
  return total.value.amountPence;
}

function latestDate(dates: ReadonlyArray<Date | null>): Date | null {
  let latest: Date | null = null;
  for (const date of dates) {
    if (date && (!latest || date > latest)) latest = date;
  }
  return latest;
}
