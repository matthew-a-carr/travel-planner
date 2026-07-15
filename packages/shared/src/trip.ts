import { z } from 'zod';
import { asofSchema } from './envelope';

/**
 * Wire shapes for the trip read surface (SPEC-009 / EPIC-002).
 *
 * `TripSummary` is the LIST projection of the server's `Trip` aggregate:
 * the trip's own fields plus a derived date range (earliest destination
 * `startDate` / latest destination `endDate`). Money follows the domain
 * convention — integer pence + currency; clients format for display.
 */

export const currencySchema = z.enum(['GBP', 'USD', 'EUR', 'AUD']);
export type WireCurrency = z.infer<typeof currencySchema>;

export const moneySchema = z.object({
  amountPence: z.number().int(),
  currency: currencySchema,
});
export type WireMoney = z.infer<typeof moneySchema>;

export const tripStatusSchema = z.enum(['planning', 'active', 'completed']);
export type WireTripStatus = z.infer<typeof tripStatusSchema>;

/**
 * Calendar date on the wire: `YYYY-MM-DD` (destination dates are
 * date-only in the domain — no time component to preserve).
 */
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
export const isoDateSchema = z
  .string()
  .regex(isoDatePattern, 'expected an ISO 8601 calendar date (YYYY-MM-DD)')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, 'expected a valid calendar date');

export const comfortLevelSchema = z.enum(['budget', 'mid', 'luxury']);
export type WireComfortLevel = z.infer<typeof comfortLevelSchema>;

export const fixedCostCategorySchema = z.enum([
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
]);
export type WireFixedCostCategory = z.infer<typeof fixedCostCategorySchema>;

export const spendCategorySchema = z.enum([
  'accommodation',
  'food',
  'transport',
  'activities',
  'shopping',
  'other',
]);
export type WireSpendCategory = z.infer<typeof spendCategorySchema>;

export const tripSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: tripStatusSchema,
  totalBudget: moneySchema,
  /**
   * Earliest non-null destination `startDate`, else `null`. Independently
   * nullable from `endDate` — a trip's destinations may carry only one of
   * the two dates.
   */
  startDate: isoDateSchema.nullable(),
  /** Latest non-null destination `endDate`, else `null`. */
  endDate: isoDateSchema.nullable(),
  organizationId: z.string().min(1),
  updatedAt: asofSchema,
});
export type TripSummary = z.infer<typeof tripSummarySchema>;

/**
 * A timeline leg on the trip detail (SPEC-010): the destination's own
 * fields plus `spent` — the sum of its recorded spend entries.
 */
export const tripDestinationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  country: z.string().min(1),
  city: z.string().nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  startDate: isoDateSchema.nullable(),
  endDate: isoDateSchema.nullable(),
  estimatedBudget: moneySchema,
  comfortLevel: comfortLevelSchema,
  sortOrder: z.number().int(),
  spent: moneySchema,
});
export type TripDestination = z.infer<typeof tripDestinationSchema>;

/** A committed fixed-cost line item (flights, insurance, …). */
export const tripFixedCostSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  amount: moneySchema,
  category: fixedCostCategorySchema,
  date: isoDateSchema,
  sortOrder: z.number().int(),
});
export type TripFixedCost = z.infer<typeof tripFixedCostSchema>;

/**
 * Budget-vs-committed/spent summary (EPIC-002 §13 Q4). Mirrors the web's
 * `getTripBudgetSummary` + `calculateTotalSpend`: `fixedCosts` + `allocated`
 * are the committed side, `spent` is recorded spend, `available` may be
 * negative when over-allocated.
 */
export const tripSpendSummarySchema = z.object({
  totalBudget: moneySchema,
  fixedCosts: moneySchema,
  allocated: moneySchema,
  available: moneySchema,
  spent: moneySchema,
  isOverAllocated: z.boolean(),
});
export type TripSpendSummary = z.infer<typeof tripSpendSummarySchema>;

export const spendEntrySchema = z.object({
  id: z.uuid(),
  destinationId: z.uuid(),
  amount: moneySchema,
  category: spendCategorySchema,
  description: z.string().nullable(),
  spentAt: isoDateSchema,
  createdAt: asofSchema,
});
export type WireSpendEntry = z.infer<typeof spendEntrySchema>;

const burndownPointSchema = z.object({
  date: isoDateSchema,
  amountPence: z.number().int(),
});

export const burndownProjectionSchema = z.object({
  idealLine: z.array(burndownPointSchema),
  actualLine: z.array(burndownPointSchema),
  projectedLine: z.array(burndownPointSchema),
  dailyPacePence: z.number().int().nonnegative(),
  targetPacePence: z.number().int().nonnegative(),
  paceRatio: z.number().nonnegative(),
  projectedExhaustionDate: isoDateSchema.nullable(),
});
export type WireBurndownProjection = z.infer<typeof burndownProjectionSchema>;

export const budgetAlertSchema = z.object({
  type: z.enum(['over-pace', 'projected-exhaustion', 'single-day-spike']),
  message: z.string().min(1),
  severity: z.enum(['warning', 'danger']),
});
export type WireBudgetAlert = z.infer<typeof budgetAlertSchema>;

export const tripFinancialsSchema = z.object({
  entries: z.array(spendEntrySchema),
  categoryTotals: z.array(
    z.object({ category: spendCategorySchema, amountPence: z.number().int().nonnegative() }),
  ),
  burndown: burndownProjectionSchema.nullable(),
  alerts: z.array(budgetAlertSchema),
});
export type TripFinancials = z.infer<typeof tripFinancialsSchema>;

/** Composite trip detail (SPEC-010): summary fields + timeline + spend. */
export const tripDetailSchema = tripSummarySchema.extend({
  destinations: z.array(tripDestinationSchema),
  fixedCosts: z.array(tripFixedCostSchema),
  spend: tripSpendSummarySchema,
});
export type TripDetail = z.infer<typeof tripDetailSchema>;

const tripNameSchema = z.string().trim().min(1).max(200);

/** Create command for POST /api/v1/trips (SPEC-022). GBP is server-owned. */
export const createTripRequestSchema = z.object({
  organizationId: z.uuid(),
  name: tripNameSchema,
  totalBudgetPence: z.number().int().positive(),
});
export type CreateTripRequest = z.infer<typeof createTripRequestSchema>;

/** Full replacement of the editable trip fields for PATCH /api/v1/trips/{id}. */
export const updateTripRequestSchema = z.object({
  name: tripNameSchema,
  totalBudgetPence: z.number().int().positive(),
  status: tripStatusSchema,
});
export type UpdateTripRequest = z.infer<typeof updateTripRequestSchema>;

const nullableDatePair = z
  .object({ startDate: isoDateSchema.nullable(), endDate: isoDateSchema.nullable() })
  .refine((value) => (value.startDate === null) === (value.endDate === null), {
    message: 'startDate and endDate must both be provided or both be null',
  });

const destinationCommandFields = z
  .object({
    name: z.string().trim().max(200),
    country: z.string().trim().min(1).max(100),
    city: z.string().trim().min(1).max(100).nullable(),
    latitude: z.number().min(-90).max(90).nullable(),
    longitude: z.number().min(-180).max(180).nullable(),
    estimatedBudgetPence: z.number().int().positive(),
    comfortLevel: comfortLevelSchema,
  })
  .and(nullableDatePair)
  .refine((value) => (value.latitude === null) === (value.longitude === null), {
    message: 'latitude and longitude must both be provided or both be null',
  });

export const createDestinationRequestSchema = destinationCommandFields;
export type CreateDestinationRequest = z.infer<typeof createDestinationRequestSchema>;
export const updateDestinationRequestSchema = destinationCommandFields.refine(
  (value) => value.name.length > 0,
  { message: 'name is required when updating a destination', path: ['name'] },
);
export type UpdateDestinationRequest = z.infer<typeof updateDestinationRequestSchema>;

const fixedCostCommandFields = z.object({
  label: z.string().trim().min(1).max(200),
  amountPence: z.number().int().positive(),
  category: fixedCostCategorySchema,
  date: isoDateSchema,
});

export const createFixedCostRequestSchema = fixedCostCommandFields;
export type CreateFixedCostRequest = z.infer<typeof createFixedCostRequestSchema>;
export const updateFixedCostRequestSchema = fixedCostCommandFields;
export type UpdateFixedCostRequest = z.infer<typeof updateFixedCostRequestSchema>;

const spendCommandFields = z.object({
  amountPence: z.number().int().positive(),
  category: spendCategorySchema,
  description: z.string().trim().max(500).nullable(),
  spentAt: isoDateSchema,
});

export const createSpendRequestSchema = spendCommandFields.extend({ destinationId: z.uuid() });
export type CreateSpendRequest = z.infer<typeof createSpendRequestSchema>;
export const updateSpendRequestSchema = spendCommandFields;
export type UpdateSpendRequest = z.infer<typeof updateSpendRequestSchema>;
