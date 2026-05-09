import { tool } from 'ai';
import { z } from 'zod';
import { sortDestinations } from '@/domain/destination/destination';
import type { DestinationRepository } from '@/domain/destination/destination-repository';
import { calculateTripBurndown, detectAlerts } from '@/domain/spending/burndown';
import { groupByCategory } from '@/domain/spending/spend-entry';
import type { SpendEntryRepository } from '@/domain/spending/spend-entry-repository';
import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';
import { getTripBudgetSummary } from '@/domain/trip/trip';
import type { TripRepository } from '@/domain/trip/trip-repository';

/**
 * Read-side dependencies the chat tools need to answer questions about a
 * trip. The tools never accept a `tripId` argument — it is bound at
 * construction time so the model cannot peek at any trip other than the one
 * the conversation is scoped to.
 */
export type ChatToolDeps = {
  readonly tripRepository: TripRepository;
  readonly destinationRepository: DestinationRepository;
  readonly spendEntryRepository: SpendEntryRepository;
  readonly tripFixedCostRepository: TripFixedCostRepository;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function isoDate(date: Date | null): string | null {
  if (date === null) return null;
  return date.toISOString().slice(0, 10);
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY));
}

/**
 * Build the read-only tool set for a single chat turn, bound to a specific
 * trip. The chat assistant calls this on every turn and passes the result to
 * `streamText({ tools })`.
 *
 * `now` is parameterised for deterministic testing; defaults to the wall
 * clock when omitted.
 */
export function createChatTools(
  deps: ChatToolDeps,
  tripId: string,
  now: () => Date = () => new Date(),
) {
  return {
    get_trip_summary: tool({
      description:
        'Returns the trip name, status, total budget, fixed-cost total, allocated and available budget (all in pence), allocation percentage, and the earliest start / latest end date across all dated destinations.',
      inputSchema: z.object({}),
      execute: async () => {
        const trip = await deps.tripRepository.findById(tripId);
        if (!trip) return { error: `Trip not found: ${tripId}` };
        const [destinations, fixedCosts] = await Promise.all([
          deps.destinationRepository.findByTrip(tripId),
          deps.tripFixedCostRepository.findByTrip(tripId),
        ]);
        const summary = getTripBudgetSummary(trip, destinations, fixedCosts);
        const dated = destinations.filter(
          (d): d is typeof d & { startDate: Date; endDate: Date } =>
            d.startDate !== null && d.endDate !== null,
        );
        const earliestStart =
          dated.length > 0 ? new Date(Math.min(...dated.map((d) => d.startDate.getTime()))) : null;
        const latestEnd =
          dated.length > 0 ? new Date(Math.max(...dated.map((d) => d.endDate.getTime()))) : null;
        return {
          name: trip.name,
          status: trip.status,
          destinationCount: destinations.length,
          datedDestinationCount: dated.length,
          fixedCostsCount: fixedCosts.length,
          totalBudgetPence: trip.totalBudget.amountPence,
          totalFixedPence: summary.totalFixed.amountPence,
          allocatedPence: summary.allocated.amountPence,
          availablePence: summary.available.amountPence,
          allocationPercentage: summary.allocationPercentage,
          isOverAllocated: summary.isOverAllocated,
          earliestStartDate: isoDate(earliestStart),
          latestEndDate: isoDate(latestEnd),
        };
      },
    }),

    list_destinations: tool({
      description:
        'Lists all destinations on the trip in sort order. Each entry includes id, name, country, city, ISO start/end dates, planned days, budget in pence, and comfort level. Undated destinations have null dates and a null `days` value.',
      inputSchema: z.object({}),
      execute: async () => {
        const destinations = await deps.destinationRepository.findByTrip(tripId);
        const sorted = sortDestinations(destinations);
        return {
          destinations: sorted.map((d) => ({
            id: d.id,
            name: d.name,
            country: d.country,
            city: d.city,
            startDate: isoDate(d.startDate),
            endDate: isoDate(d.endDate),
            days: d.startDate && d.endDate ? daysBetween(d.startDate, d.endDate) : null,
            budgetPence: d.estimatedBudget.amountPence,
            comfortLevel: d.comfortLevel,
          })),
        };
      },
    }),

    get_burndown: tool({
      description:
        'Returns the trip-wide burndown: daily pace (avg pence/day spent so far), target pace (pence/day to stay on budget), pace ratio (1.0 = on pace, >1 = over), projected exhaustion date if any, total spent across all destinations, and any active budget alerts. Returns `null` for the projection if the trip has no dated destinations yet.',
      inputSchema: z.object({}),
      execute: async () => {
        const [destinations, allSpend] = await Promise.all([
          deps.destinationRepository.findByTrip(tripId),
          deps.spendEntryRepository.findByTrip(tripId),
        ]);
        const currentDate = now();
        const projection = calculateTripBurndown(destinations, allSpend, currentDate);
        const totalSpentPence = allSpend.reduce((sum, e) => sum + e.amount.amountPence, 0);
        if (projection === null) {
          return {
            currentDate: isoDate(currentDate),
            totalSpentPence,
            projection: null,
            alerts: [],
          };
        }
        const dated = destinations.filter(
          (d): d is typeof d & { startDate: Date; endDate: Date } =>
            d.startDate !== null && d.endDate !== null,
        );
        const latestEnd = new Date(Math.max(...dated.map((d) => d.endDate.getTime())));
        const alerts = detectAlerts(projection, allSpend, latestEnd);
        return {
          currentDate: isoDate(currentDate),
          totalSpentPence,
          projection: {
            dailyPacePence: projection.dailyPacePence,
            targetPacePence: projection.targetPacePence,
            paceRatio: Number(projection.paceRatio.toFixed(3)),
            projectedExhaustionDate: isoDate(projection.projectedExhaustionDate),
          },
          alerts: alerts.map((a) => ({
            type: a.type,
            severity: a.severity,
            message: a.message,
          })),
        };
      },
    }),

    get_spending_by_category: tool({
      description:
        'Aggregates all spend entries on the trip by category. Returns total pence per category, the overall total, and the entry count.',
      inputSchema: z.object({}),
      execute: async () => {
        const allSpend = await deps.spendEntryRepository.findByTrip(tripId);
        const grouped = groupByCategory(allSpend);
        const byCategory: Record<string, number> = {};
        for (const [category, entries] of grouped) {
          byCategory[category] = entries.reduce((sum, e) => sum + e.amount.amountPence, 0);
        }
        const totalPence = allSpend.reduce((sum, e) => sum + e.amount.amountPence, 0);
        return {
          byCategoryPence: byCategory,
          totalPence,
          entryCount: allSpend.length,
        };
      },
    }),
  };
}
