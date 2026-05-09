import { tool } from 'ai';
import { z } from 'zod';
import { addFixedCost } from '@/application/use-cases/add-fixed-cost';
import { deleteSpendEntry } from '@/application/use-cases/delete-spend-entry';
import { editDestination } from '@/application/use-cases/edit-destination';
import { editTrip } from '@/application/use-cases/edit-trip';
import { recordSpend } from '@/application/use-cases/record-spend';
import { classifyToolRisk } from '@/domain/chat/classify-tool-risk';
import { sortDestinations } from '@/domain/destination/destination';
import type { DestinationRepository } from '@/domain/destination/destination-repository';
import { calculateTripBurndown, detectAlerts } from '@/domain/spending/burndown';
import { groupByCategory } from '@/domain/spending/spend-entry';
import type { SpendEntryRepository } from '@/domain/spending/spend-entry-repository';
import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';
import { getTripBudgetSummary } from '@/domain/trip/trip';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type {
  ComfortLevel,
  Destination,
  FixedCostCategory,
  SpendCategory,
} from '@/domain/trip/types';

export type ChatToolDeps = {
  readonly tripRepository: TripRepository;
  readonly destinationRepository: DestinationRepository;
  readonly spendEntryRepository: SpendEntryRepository;
  readonly tripFixedCostRepository: TripFixedCostRepository;
};

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const SPEND_CATEGORIES = [
  'accommodation',
  'food',
  'transport',
  'activities',
  'shopping',
  'other',
] as const satisfies readonly SpendCategory[];

const FIXED_COST_CATEGORIES = [
  'accommodation',
  'activities',
  'bills',
  'eating-out',
  'fuel',
  'groceries',
  'healthcare',
  'insurance',
  'shopping',
  'subscriptions',
  'transport',
  'visas',
  'other',
] as const satisfies readonly FixedCostCategory[];

const COMFORT_LEVELS = ['budget', 'mid', 'luxury'] as const satisfies readonly ComfortLevel[];

const TRIP_STATUSES = ['planning', 'active', 'completed'] as const;

function isoDate(date: Date | null): string | null {
  if (date === null) return null;
  return date.toISOString().slice(0, 10);
}

function parseIsoDate(value: string): Date | null {
  // Accept YYYY-MM-DD and full ISO strings; treat as UTC midnight when only a
  // date is given.
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const ms = Date.parse(/T/.test(trimmed) ? trimmed : `${trimmed}T00:00:00Z`);
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY));
}

function formatGbp(pence: number): string {
  const sign = pence < 0 ? '-' : '';
  const abs = Math.abs(pence);
  const pounds = (abs / 100).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}£${pounds}`;
}

/**
 * Build the read-only and write tool set for a single chat turn, bound to a
 * specific trip. The chat assistant calls this on every turn and passes the
 * result to `streamText({ tools })`.
 *
 * Write tools follow the inline-confirm protocol:
 * - low-risk mutations execute immediately and return a success payload
 * - high-risk mutations return `{ requiresConfirmation: true, summary }`
 *   when called without `confirmed: true`. The model is instructed (via the
 *   system prompt) to relay the summary verbatim and only re-call with
 *   `confirmed: true` if the user explicitly confirms.
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

    record_spend: tool({
      description:
        "Records a single spend entry on a destination of the bound trip. All amounts are pence (GBP). Dates default to today if omitted. Risky spends (well above the daily pace target, or larger than what's left on the destination) require user confirmation: the tool returns `{ requiresConfirmation: true, summary }` and you must ask the user to confirm verbatim before re-calling with `confirmed: true`.",
      inputSchema: z.object({
        destinationId: z.string().min(1),
        amountPence: z.number().int().positive(),
        category: z.enum(SPEND_CATEGORIES),
        description: z.string().nullish(),
        spentAt: z.string().nullish(),
        confirmed: z.boolean().optional(),
      }),
      execute: async (args) => {
        const destination = await deps.destinationRepository.findById(args.destinationId);
        if (!destination || destination.tripId !== tripId) {
          return { error: 'Destination is not part of this trip.' };
        }
        const spentAt = args.spentAt ? parseIsoDate(args.spentAt) : now();
        if (spentAt === null) {
          return { error: `Could not parse spentAt: ${args.spentAt}` };
        }

        const [allSpend, allDestinations] = await Promise.all([
          deps.spendEntryRepository.findByTrip(tripId),
          deps.destinationRepository.findByTrip(tripId),
        ]);
        const destSpentPence = allSpend
          .filter((s) => s.destinationId === destination.id)
          .reduce((sum, s) => sum + s.amount.amountPence, 0);
        const destinationAvailablePence = destination.estimatedBudget.amountPence - destSpentPence;
        const projection = calculateTripBurndown(allDestinations, allSpend, now());
        const remainingDailyBudgetPence = projection?.targetPacePence ?? 0;

        if (args.confirmed !== true) {
          const risk = classifyToolRisk('record_spend', {
            amountPence: args.amountPence,
            destinationAvailablePence,
            remainingDailyBudgetPence,
            fixedCostHeadroomPence: 0,
            changesScheduleDates: false,
            breachesAllocationCap: false,
          });
          if (risk === 'confirm') {
            const reason =
              args.amountPence > destinationAvailablePence
                ? `${formatGbp(destination.estimatedBudget.amountPence)} allocated, ${formatGbp(destinationAvailablePence)} left on ${destination.name}`
                : `daily target is ${formatGbp(remainingDailyBudgetPence)}/day`;
            return {
              requiresConfirmation: true,
              summary: `Record ${formatGbp(args.amountPence)} of ${args.category} on ${destination.name}? Heads-up: ${reason}.`,
            };
          }
        }

        const result = await recordSpend(deps.destinationRepository, deps.spendEntryRepository, {
          destinationId: args.destinationId,
          amountPence: args.amountPence,
          currency: 'GBP',
          category: args.category,
          description: args.description ?? null,
          spentAt,
        });
        if (!result.ok) return { error: result.error };
        return {
          ok: true,
          spendEntryId: result.value.id,
          summary: `Recorded ${formatGbp(args.amountPence)} of ${args.category} on ${destination.name}.`,
        };
      },
    }),

    edit_destination: tool({
      description:
        'Updates fields on a destination of the bound trip. Only the fields you provide will change; omitted fields keep their current value. Date changes and budget edits that would exceed available headroom require confirmation. All amounts are pence (GBP). Dates are YYYY-MM-DD.',
      inputSchema: z.object({
        destinationId: z.string().min(1),
        name: z.string().min(1).optional(),
        country: z.string().min(1).optional(),
        city: z.string().nullish(),
        latitude: z.number().nullish(),
        longitude: z.number().nullish(),
        estimatedBudgetPence: z.number().int().nonnegative().optional(),
        comfortLevel: z.enum(COMFORT_LEVELS).optional(),
        startDate: z.string().nullish(),
        endDate: z.string().nullish(),
        confirmed: z.boolean().optional(),
      }),
      execute: async (args) => {
        const existing = await deps.destinationRepository.findById(args.destinationId);
        if (!existing || existing.tripId !== tripId) {
          return { error: 'Destination is not part of this trip.' };
        }
        const merged = mergeDestinationEdit(existing, args);
        if (!merged.ok) return { error: merged.error };
        const updated = merged.value;

        if (args.confirmed !== true) {
          const trip = await deps.tripRepository.findById(tripId);
          if (!trip) return { error: 'Trip not found' };
          const [allDestinations, fixedCosts] = await Promise.all([
            deps.destinationRepository.findByTrip(tripId),
            deps.tripFixedCostRepository.findByTrip(tripId),
          ]);
          const otherAllocated = allDestinations
            .filter((d) => d.id !== existing.id)
            .reduce((sum, d) => sum + d.estimatedBudget.amountPence, 0);
          const totalFixed = fixedCosts.reduce((sum, fc) => sum + fc.amount.amountPence, 0);
          const availableForThis = trip.totalBudget.amountPence - totalFixed - otherAllocated;
          const breachesAllocationCap = updated.estimatedBudgetPence > availableForThis;
          const changesScheduleDates =
            (existing.startDate?.getTime() ?? null) !== (updated.startDate?.getTime() ?? null) ||
            (existing.endDate?.getTime() ?? null) !== (updated.endDate?.getTime() ?? null);

          const risk = classifyToolRisk('edit_destination', {
            amountPence: updated.estimatedBudgetPence,
            destinationAvailablePence: 0,
            remainingDailyBudgetPence: 0,
            fixedCostHeadroomPence: 0,
            changesScheduleDates,
            breachesAllocationCap,
          });
          if (risk === 'confirm') {
            const reasons: string[] = [];
            if (changesScheduleDates) reasons.push('this changes the schedule dates');
            if (breachesAllocationCap)
              reasons.push(
                `the new budget (${formatGbp(updated.estimatedBudgetPence)}) exceeds available headroom (${formatGbp(availableForThis)})`,
              );
            return {
              requiresConfirmation: true,
              summary: `Edit ${existing.name}? Heads-up: ${reasons.join('; ')}.`,
            };
          }
        }

        const result = await editDestination(
          deps.tripRepository,
          deps.destinationRepository,
          deps.tripFixedCostRepository,
          {
            destinationId: existing.id,
            tripId,
            name: updated.name,
            country: updated.country,
            city: updated.city,
            latitude: updated.latitude,
            longitude: updated.longitude,
            estimatedBudgetPence: updated.estimatedBudgetPence,
            currency: 'GBP',
            comfortLevel: updated.comfortLevel,
            startDate: updated.startDate,
            endDate: updated.endDate,
          },
        );
        if (!result.ok) return { error: result.error };
        return {
          ok: true,
          destinationId: result.value.id,
          summary: `Updated ${result.value.name}.`,
        };
      },
    }),

    add_fixed_cost: tool({
      description:
        'Adds a named fixed cost (flights, insurance, visas, etc.) to the bound trip. All amounts are pence (GBP). Dates are YYYY-MM-DD. Costs that would push the fixed-cost total over the trip headroom require confirmation.',
      inputSchema: z.object({
        label: z.string().min(1),
        amountPence: z.number().int().positive(),
        category: z.enum(FIXED_COST_CATEGORIES),
        date: z.string(),
        confirmed: z.boolean().optional(),
      }),
      execute: async (args) => {
        const date = parseIsoDate(args.date);
        if (date === null) return { error: `Could not parse date: ${args.date}` };

        if (args.confirmed !== true) {
          const trip = await deps.tripRepository.findById(tripId);
          if (!trip) return { error: 'Trip not found' };
          const [destinations, fixedCosts] = await Promise.all([
            deps.destinationRepository.findByTrip(tripId),
            deps.tripFixedCostRepository.findByTrip(tripId),
          ]);
          const allocated = destinations.reduce((sum, d) => sum + d.estimatedBudget.amountPence, 0);
          const fixedTotal = fixedCosts.reduce((sum, fc) => sum + fc.amount.amountPence, 0);
          const fixedCostHeadroomPence = trip.totalBudget.amountPence - allocated - fixedTotal;

          const risk = classifyToolRisk('add_fixed_cost', {
            amountPence: args.amountPence,
            destinationAvailablePence: 0,
            remainingDailyBudgetPence: 0,
            fixedCostHeadroomPence,
            changesScheduleDates: false,
            breachesAllocationCap: false,
          });
          if (risk === 'confirm') {
            return {
              requiresConfirmation: true,
              summary: `Add fixed cost "${args.label}" for ${formatGbp(args.amountPence)}? Heads-up: this exceeds the remaining headroom of ${formatGbp(fixedCostHeadroomPence)}.`,
            };
          }
        }

        const result = await addFixedCost(deps.tripRepository, deps.tripFixedCostRepository, {
          tripId,
          label: args.label,
          amountPence: args.amountPence,
          currency: 'GBP',
          category: args.category,
          date,
        });
        if (!result.ok) return { error: result.error };
        return {
          ok: true,
          fixedCostId: result.value.id,
          summary: `Added "${args.label}" — ${formatGbp(args.amountPence)} on ${isoDate(date)}.`,
        };
      },
    }),

    edit_trip_budget: tool({
      description:
        'Changes the trip total budget (status, name, and budget combined). Always requires confirmation — this changes a trip-level invariant. Amounts are pence (GBP).',
      inputSchema: z.object({
        totalBudgetPence: z.number().int().positive(),
        name: z.string().min(1).optional(),
        status: z.enum(TRIP_STATUSES).optional(),
        confirmed: z.boolean().optional(),
      }),
      execute: async (args) => {
        const trip = await deps.tripRepository.findById(tripId);
        if (!trip) return { error: 'Trip not found' };

        if (args.confirmed !== true) {
          return {
            requiresConfirmation: true,
            summary: `Change trip budget from ${formatGbp(trip.totalBudget.amountPence)} to ${formatGbp(args.totalBudgetPence)}?`,
          };
        }

        const result = await editTrip(
          deps.tripRepository,
          deps.destinationRepository,
          deps.tripFixedCostRepository,
          {
            tripId,
            name: args.name ?? trip.name,
            totalBudgetPence: args.totalBudgetPence,
            currency: 'GBP',
            status: args.status ?? trip.status,
          },
        );
        if (!result.ok) return { error: result.error };
        return {
          ok: true,
          summary: `Trip budget set to ${formatGbp(result.value.totalBudget.amountPence)}.`,
        };
      },
    }),

    delete_spend_entry: tool({
      description:
        'Deletes a spend entry on the bound trip. Always auto-executes — the prior values are returned so the user can ask to put it back.',
      inputSchema: z.object({
        spendEntryId: z.string().min(1),
      }),
      execute: async (args) => {
        const entry = await deps.spendEntryRepository.findById(args.spendEntryId);
        if (entry === null) return { error: 'Spend entry not found.' };
        const destination = await deps.destinationRepository.findById(entry.destinationId);
        if (!destination || destination.tripId !== tripId) {
          return { error: 'Spend entry is not part of this trip.' };
        }
        const result = await deleteSpendEntry(deps.spendEntryRepository, args.spendEntryId);
        if (!result.ok) return { error: result.error };
        return {
          ok: true,
          summary: `Deleted ${formatGbp(entry.amount.amountPence)} of ${entry.category} on ${destination.name}.`,
          undo: {
            kind: 'record_spend',
            destinationId: entry.destinationId,
            amountPence: entry.amount.amountPence,
            category: entry.category,
            description: entry.description,
            spentAt: entry.spentAt.toISOString(),
          },
        };
      },
    }),
  };
}

type DestinationEditFields = {
  readonly name: string;
  readonly country: string;
  readonly city: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly estimatedBudgetPence: number;
  readonly comfortLevel: ComfortLevel;
  readonly startDate: Date | null;
  readonly endDate: Date | null;
};

function mergeDestinationEdit(
  existing: Destination,
  args: {
    name?: string;
    country?: string;
    city?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    estimatedBudgetPence?: number;
    comfortLevel?: ComfortLevel;
    startDate?: string | null;
    endDate?: string | null;
  },
): { ok: true; value: DestinationEditFields } | { ok: false; error: string } {
  let startDate: Date | null = existing.startDate;
  if (args.startDate !== undefined) {
    if (args.startDate === null) {
      startDate = null;
    } else {
      const parsed = parseIsoDate(args.startDate);
      if (parsed === null)
        return { ok: false, error: `Could not parse startDate: ${args.startDate}` };
      startDate = parsed;
    }
  }
  let endDate: Date | null = existing.endDate;
  if (args.endDate !== undefined) {
    if (args.endDate === null) {
      endDate = null;
    } else {
      const parsed = parseIsoDate(args.endDate);
      if (parsed === null) return { ok: false, error: `Could not parse endDate: ${args.endDate}` };
      endDate = parsed;
    }
  }
  return {
    ok: true,
    value: {
      name: args.name ?? existing.name,
      country: args.country ?? existing.country,
      city: args.city === undefined ? existing.city : args.city,
      latitude: args.latitude === undefined ? existing.latitude : args.latitude,
      longitude: args.longitude === undefined ? existing.longitude : args.longitude,
      estimatedBudgetPence: args.estimatedBudgetPence ?? existing.estimatedBudget.amountPence,
      comfortLevel: args.comfortLevel ?? existing.comfortLevel,
      startDate,
      endDate,
    },
  };
}
