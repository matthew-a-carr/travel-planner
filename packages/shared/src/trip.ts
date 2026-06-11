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
  .regex(isoDatePattern, 'expected an ISO 8601 calendar date (YYYY-MM-DD)');

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
