/**
 * Risk classification for chat-tool mutations. Pure function with no
 * external dependencies — the caller (chat-tools layer) gathers the
 * runtime context, classifies, and decides whether to execute or ask the
 * user to confirm.
 *
 * Policy (closes ADR 042 open questions):
 * - record_spend: auto iff the spend is within ~1.5× of the daily pace
 *   target AND fits within what's available on the destination. Else
 *   confirm — the user is overshooting and should double-check.
 * - edit_destination: confirm iff the edit changes schedule dates OR the
 *   estimated-budget delta would push the trip over its allocation cap.
 *   Pure label/comfort tweaks are auto.
 * - add_fixed_cost: auto iff the new fixed cost fits in the remaining
 *   headroom; else confirm (would breach the trip-budget invariant).
 * - edit_trip_budget: always confirm — changes a trip-level invariant.
 * - delete_spend_entry: always auto — reversible via inline undo (the
 *   tool result includes the prior entry so the user can ask to put it
 *   back).
 */

export type ToolName =
  | 'record_spend'
  | 'edit_destination'
  | 'add_fixed_cost'
  | 'edit_trip_budget'
  | 'delete_spend_entry';

export type ToolRisk = 'auto' | 'confirm';

export type ClassifyContext = {
  /** Trip-wide target pace × 1 day, in pence. 0 if unknown / no dated plan. */
  readonly remainingDailyBudgetPence: number;
  /** Destination allocation − spend already on that destination, in pence. */
  readonly destinationAvailablePence: number;
  /** Trip total − allocated to destinations − existing fixed costs, in pence. */
  readonly fixedCostHeadroomPence: number;
  /** True if the proposed edit changes a destination's start/end date. */
  readonly changesScheduleDates: boolean;
  /** True if the budget delta on an edit would exceed available headroom. */
  readonly breachesAllocationCap: boolean;
  /** Pence amount of the proposed mutation (spend or fixed cost). */
  readonly amountPence: number;
};

const DAILY_PACE_HEADROOM_MULTIPLIER = 1.5;

export function classifyToolRisk(tool: ToolName, ctx: ClassifyContext): ToolRisk {
  switch (tool) {
    case 'edit_trip_budget':
      return 'confirm';
    case 'delete_spend_entry':
      return 'auto';
    case 'record_spend': {
      const withinPace =
        ctx.remainingDailyBudgetPence > 0
          ? ctx.amountPence <= ctx.remainingDailyBudgetPence * DAILY_PACE_HEADROOM_MULTIPLIER
          : false;
      const withinDestination = ctx.amountPence <= ctx.destinationAvailablePence;
      return withinPace && withinDestination ? 'auto' : 'confirm';
    }
    case 'edit_destination':
      if (ctx.changesScheduleDates) return 'confirm';
      if (ctx.breachesAllocationCap) return 'confirm';
      return 'auto';
    case 'add_fixed_cost':
      return ctx.amountPence <= ctx.fixedCostHeadroomPence ? 'auto' : 'confirm';
  }
}
