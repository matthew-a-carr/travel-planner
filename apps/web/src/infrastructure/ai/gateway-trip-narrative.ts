import { generateObject } from 'ai';
import { z } from 'zod';
import type {
  TripNarrativeInput,
  TripNarrativeOutcome,
  TripNarrativeService,
} from '@/application/ports/trip-narrative-service';
import { calculateTripBurndown, detectAlerts } from '@/domain/spending/burndown';
import { getTripBudgetSummary } from '@/domain/trip/trip';

const narrativeSchema = z.object({
  narrative: z.string().min(20).max(280),
  bullets: z.array(z.string().min(4).max(120)).max(3),
});

const SYSTEM_PROMPT = `You are a personal-finance assistant for a travel-budgeting app.
Given a structured snapshot of a trip's budget, spending, and burndown pace,
return a 2-3 sentence narrative explaining the *so what* and up to 3 short
bullet suggestions for the user to consider next.

Rules:
- 'narrative' is one paragraph, 2-3 sentences, <= 280 chars. Use real numbers
  from the snapshot; never invent figures.
- 'bullets' are 0-3 short imperatives the user could take next. <= 120 chars each.
- Mention £ for money (e.g. 'You're £40/day above pace'). No emoji, no filler.
- If the trip is comfortably on pace, say so plainly and emit an empty bullets array.
- If no spending or dated destinations exist yet, write a forward-looking note
  about the plan instead of trying to evaluate pace.`;

type TripSnapshot = {
  tripName: string;
  tripStatus: string;
  currentDate: string;
  totalBudgetPence: number;
  totalFixedPence: number;
  allocatedPence: number;
  availablePence: number;
  allocationPercentage: number;
  isOverAllocated: boolean;
  destinationCount: number;
  datedDestinationCount: number;
  totalSpentPence: number;
  projection: {
    dailyPacePence: number;
    targetPacePence: number;
    paceRatio: number;
    projectedExhaustionDate: string | null;
  } | null;
  alerts: {
    type: string;
    severity: 'warning' | 'danger';
    message: string;
  }[];
};

function toSnapshot(input: TripNarrativeInput): TripSnapshot {
  const summary = getTripBudgetSummary(input.trip, input.destinations, input.fixedCosts);
  const projection = calculateTripBurndown(
    input.destinations,
    input.spendEntries,
    input.currentDate,
  );
  const dated = input.destinations.filter((d) => d.startDate !== null && d.endDate !== null);
  const latestEnd =
    dated.length > 0
      ? new Date(
          Math.max(
            ...dated.map((d) => {
              const end = d.endDate;
              return end ? end.getTime() : 0;
            }),
          ),
        )
      : input.currentDate;
  const alerts = projection ? detectAlerts(projection, input.spendEntries, latestEnd) : [];
  const totalSpentPence = input.spendEntries.reduce((sum, e) => sum + e.amount.amountPence, 0);

  return {
    tripName: input.trip.name,
    tripStatus: input.trip.status,
    currentDate: input.currentDate.toISOString().slice(0, 10),
    totalBudgetPence: input.trip.totalBudget.amountPence,
    totalFixedPence: summary.totalFixed.amountPence,
    allocatedPence: summary.allocated.amountPence,
    availablePence: summary.available.amountPence,
    allocationPercentage: summary.allocationPercentage,
    isOverAllocated: summary.isOverAllocated,
    destinationCount: input.destinations.length,
    datedDestinationCount: dated.length,
    totalSpentPence,
    projection: projection
      ? {
          dailyPacePence: projection.dailyPacePence,
          targetPacePence: projection.targetPacePence,
          paceRatio: Number(projection.paceRatio.toFixed(3)),
          projectedExhaustionDate:
            projection.projectedExhaustionDate?.toISOString().slice(0, 10) ?? null,
        }
      : null,
    alerts: alerts.map((a) => ({ type: a.type, severity: a.severity, message: a.message })),
  };
}

export class GatewayTripNarrativeService implements TripNarrativeService {
  constructor(private readonly modelId: string) {}

  async summarise(input: TripNarrativeInput): Promise<TripNarrativeOutcome> {
    const snapshot = toSnapshot(input);

    try {
      const { object } = await generateObject({
        model: this.modelId,
        schema: narrativeSchema,
        system: SYSTEM_PROMPT,
        prompt: `Trip snapshot:\n${JSON.stringify(snapshot, null, 2)}`,
      });
      return {
        ok: true,
        result: { narrative: object.narrative, bullets: object.bullets },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown narrative error';
      return { ok: false, error: `Trip narrative failed: ${message}` };
    }
  }
}
