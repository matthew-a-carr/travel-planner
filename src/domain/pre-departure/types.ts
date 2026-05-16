/**
 * Pre-departure planning helper domain types.
 *
 * Two kinds of suggestion produced by `PreDeparturePlannerService`:
 *   - `ChecklistItem` — visas, vaccinations, insurance, banking, admin.
 *   - `TransportLeg` — proposed inter-country transport between two
 *     consecutive dated destinations.
 *
 * Both are intentionally trip-context-free at this layer: they carry
 * the data needed to render a row and post it to
 * `addFixedCostAction(tripId, ...)`, but nothing about the surrounding
 * trip. The use case enriches with trip context where useful.
 */

export type ChecklistCategory = 'visa' | 'vaccination' | 'insurance' | 'banking' | 'admin';

export type VerifySource = 'embassy' | 'doctor' | 'insurer' | 'bank';

export type ChecklistItem = {
  readonly title: string;
  readonly category: ChecklistCategory;
  /** ISO-style Date when the user should act, relative to the trip
   *  start. `null` if the item is open-ended. */
  readonly dueDate: Date | null;
  /** Typical mid-range cost in pence, or `null` when the model can't
   *  responsibly stamp a number (e.g. "open a savings pot"). */
  readonly costPence: number | null;
  readonly suggestion: string | null;
  /** When set, the rendered suggestion must include
   *  "verify with the …" — see ADR 045's conservatism rules. */
  readonly verifyAt: VerifySource | null;
};

export type TransportMode = 'flight' | 'train' | 'bus' | 'ferry' | 'car';

export type TransportLeg = {
  readonly fromDestinationId: string;
  readonly toDestinationId: string;
  readonly mode: TransportMode;
  readonly typicalCostPence: number;
  readonly bookingLeadDays: number;
  readonly notes: string | null;
};

export type PreDeparturePlan = {
  readonly items: readonly ChecklistItem[];
  readonly transportLegs: readonly TransportLeg[];
};
