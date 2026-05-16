import { generateObject } from 'ai';
import { z } from 'zod';
import type {
  PreDeparturePlanInput,
  PreDeparturePlannerService,
  PreDeparturePlanOutcome,
} from '@/application/ports/pre-departure-planner-service';
import type {
  ChecklistCategory,
  ChecklistItem,
  TransportLeg,
  TransportMode,
  VerifySource,
} from '@/domain/pre-departure/types';
import { getTripBudgetSummary } from '@/domain/trip/trip';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const checklistItemSchema = z.object({
  title: z.string().min(4).max(120),
  category: z.enum(['visa', 'vaccination', 'insurance', 'banking', 'admin']),
  dueDate: isoDate.nullable(),
  costPence: z.number().int().nonnegative().nullable(),
  suggestion: z.string().min(4).max(280).nullable(),
  verifyAt: z.enum(['embassy', 'doctor', 'insurer', 'bank']).nullable(),
});

const transportLegSchema = z.object({
  fromDestinationId: z.string().min(1),
  toDestinationId: z.string().min(1),
  mode: z.enum(['flight', 'train', 'bus', 'ferry', 'car']),
  typicalCostPence: z.number().int().positive(),
  bookingLeadDays: z.number().int().nonnegative(),
  notes: z.string().min(4).max(280).nullable(),
});

const planSchema = z.object({
  items: z.array(checklistItemSchema).max(12),
  transportLegs: z.array(transportLegSchema).max(8),
});

const SYSTEM_PROMPT = `You are a pre-departure planner for a UK-passport-holder
preparing a multi-country trip. You receive a JSON snapshot of the trip's
destinations (with dates and country names), the trip's current fixed costs,
and today's date. Return up to 12 checklist items and up to 8 transport legs.

Checklist items — propose these only when well-established:
- 'visa': the destination's country typically requires a short-stay tourist
  visa (or a working-holiday visa where the destination dates fit the
  pattern, e.g. Australia for ~12 months at the end of the trip). Set
  verifyAt = 'embassy'. The suggestion must include "verify with the embassy"
  because policies change.
- 'vaccination': a vaccination or health document is well-established as
  required or strongly recommended (yellow fever certificate for entry
  from a yellow-fever-zone, hep A/B series for SE Asia, malaria
  prophylaxis where relevant). Set verifyAt = 'doctor'. The suggestion
  must include "verify with a travel-health clinic".
- 'insurance': a multi-month travel/health insurance policy. If the trip
  includes a working-holiday-shaped stay (e.g. Australia ~12 months
  late in the trip), prefer a policy that explicitly covers
  working-holiday-visa stays. Set verifyAt = 'insurer'. The suggestion
  must include "verify with the insurer".
- 'banking': fee-free debit card / multi-currency card / spending pot,
  with costPence = null when no obvious fee is involved. verifyAt =
  'bank' optional.
- 'admin': open-ended pre-departure admin (mail forwarding,
  international driving permit, GHIC renewal). costPence usually null.

For each item:
- 'title' is a short imperative phrase (≤ 120 chars), e.g. "Apply for
  Australia Working Holiday Visa (Subclass 417/462)".
- 'dueDate' is the date by which the user should act, computed relative
  to the *first* dated destination's start (the trip start). When you
  can't pick a date confidently, set it null.
- 'costPence' is a typical mid-range cost (integer pence, GBP). Use
  well-known figures (Australia WHV ≈ £455 ≈ 45500). When you can't
  cite one responsibly, set null.

Transport legs — only for inter-country gaps between consecutive dated
destinations:
- 'mode' is the typical primary mode for the leg (flight for
  intercontinental; train/bus/ferry where geography makes sense; never
  invent a mode).
- 'typicalCostPence' is the mid-range single-fare ballpark per person
  in pence, GBP. Be conservative — don't quote outliers.
- 'bookingLeadDays' is the recommended lead time before the leg's
  start date.
- 'fromDestinationId' and 'toDestinationId' must be ids from the
  input. Never invent ids.

Rules:
- Be conservative — skip rather than fabricate. When in doubt, omit.
- Suppress any 'visa' item where the existing fixedCosts list already
  contains a row of category 'visas' whose label clearly mentions the
  destination country.
- One item per (category, country) and one leg per (fromId, toId).
- Use today's date (provided in the snapshot) to pace lead times. Do
  not invent today.
- Items and legs are listed independently — don't combine them.`;

type SnapshotDestination = {
  id: string;
  name: string;
  country: string;
  startDate: string | null;
  endDate: string | null;
  comfortLevel: string;
};

type SnapshotFixedCost = {
  id: string;
  label: string;
  category: string;
  date: string;
  amountPence: number;
};

type TripSnapshot = {
  tripName: string;
  tripStatus: string;
  currentDate: string;
  tripStartDate: string | null;
  totalBudgetPence: number;
  totalFixedPence: number;
  availablePence: number;
  destinations: SnapshotDestination[];
  fixedCosts: SnapshotFixedCost[];
};

function toSnapshot(input: PreDeparturePlanInput): TripSnapshot {
  const summary = getTripBudgetSummary(input.trip, input.destinations, input.fixedCosts);
  const dated = input.destinations.filter(
    (d): d is typeof d & { startDate: Date; endDate: Date } =>
      d.startDate !== null && d.endDate !== null,
  );
  const tripStart =
    dated.length > 0 ? new Date(Math.min(...dated.map((d) => d.startDate.getTime()))) : null;

  return {
    tripName: input.trip.name,
    tripStatus: input.trip.status,
    currentDate: input.currentDate.toISOString().slice(0, 10),
    tripStartDate: tripStart ? tripStart.toISOString().slice(0, 10) : null,
    totalBudgetPence: input.trip.totalBudget.amountPence,
    totalFixedPence: summary.totalFixed.amountPence,
    availablePence: summary.available.amountPence,
    destinations: input.destinations.map((d) => ({
      id: d.id,
      name: d.name,
      country: d.country,
      startDate: d.startDate ? d.startDate.toISOString().slice(0, 10) : null,
      endDate: d.endDate ? d.endDate.toISOString().slice(0, 10) : null,
      comfortLevel: d.comfortLevel,
    })),
    fixedCosts: input.fixedCosts.map((f) => ({
      id: f.id,
      label: f.label,
      category: f.category,
      date: f.date.toISOString().slice(0, 10),
      amountPence: f.amount.amountPence,
    })),
  };
}

function parseDate(value: string | null): Date | null {
  if (value === null) return null;
  return new Date(`${value}T00:00:00Z`);
}

export class GatewayPreDeparturePlannerService implements PreDeparturePlannerService {
  constructor(private readonly modelId: string) {}

  async plan(input: PreDeparturePlanInput): Promise<PreDeparturePlanOutcome> {
    if (input.destinations.length === 0) {
      return { ok: true, result: { items: [], transportLegs: [] } };
    }

    try {
      const { object } = await generateObject({
        model: this.modelId,
        schema: planSchema,
        system: SYSTEM_PROMPT,
        prompt: `Trip snapshot:\n${JSON.stringify(toSnapshot(input), null, 2)}`,
      });

      const items: ChecklistItem[] = object.items.map((i) => ({
        title: i.title,
        category: i.category as ChecklistCategory,
        dueDate: parseDate(i.dueDate),
        costPence: i.costPence,
        suggestion: i.suggestion,
        verifyAt: i.verifyAt as VerifySource | null,
      }));

      const transportLegs: TransportLeg[] = object.transportLegs.map((l) => ({
        fromDestinationId: l.fromDestinationId,
        toDestinationId: l.toDestinationId,
        mode: l.mode as TransportMode,
        typicalCostPence: l.typicalCostPence,
        bookingLeadDays: l.bookingLeadDays,
        notes: l.notes,
      }));

      return { ok: true, result: { items, transportLegs } };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown planner error';
      return { ok: false, error: `Pre-departure planner failed: ${message}` };
    }
  }
}
