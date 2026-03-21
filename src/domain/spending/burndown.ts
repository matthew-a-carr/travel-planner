import type { Destination, SpendEntry } from '../trip/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type BurndownDataPoint = {
  readonly date: Date;
  readonly amountPence: number;
};

export type BurndownProjection = {
  readonly idealLine: readonly BurndownDataPoint[];
  readonly actualLine: readonly BurndownDataPoint[];
  readonly projectedLine: readonly BurndownDataPoint[];
  readonly dailyPacePence: number;
  readonly targetPacePence: number;
  readonly paceRatio: number;
  readonly projectedExhaustionDate: Date | null;
};

export type BudgetAlertType = 'over-pace' | 'projected-exhaustion' | 'single-day-spike';

export type BudgetAlert = {
  readonly type: BudgetAlertType;
  readonly message: string;
  readonly severity: 'warning' | 'danger';
};

// ─── Constants ───────────────────────────────────────────────────────────────

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const OVER_PACE_THRESHOLD = 1.2;
const SINGLE_DAY_SPIKE_MULTIPLIER = 2;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysBetween(start: Date, end: Date): number {
  return Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Groups spend entries by day (start-of-day) and returns total pence per day,
 * sorted chronologically.
 */
function dailySpendTotals(entries: readonly SpendEntry[]): { date: Date; totalPence: number }[] {
  const byDay = new Map<number, number>();
  for (const entry of entries) {
    const dayKey = startOfDay(entry.spentAt).getTime();
    byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + entry.amount.amountPence);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([ms, totalPence]) => ({ date: new Date(ms), totalPence }));
}

// ─── Core functions ──────────────────────────────────────────────────────────

/**
 * Calculates the average daily spend in pence.
 * Returns 0 if no days have elapsed or no entries exist.
 */
export function calculateDailyPace(
  entries: readonly SpendEntry[],
  startDate: Date,
  currentDate: Date,
): number {
  const daysElapsed = daysBetween(startDate, currentDate);
  if (daysElapsed <= 0 || entries.length === 0) return 0;

  const totalPence = entries.reduce((sum, e) => sum + e.amount.amountPence, 0);
  return Math.round(totalPence / daysElapsed);
}

/**
 * Calculates the target daily spend to stay on budget.
 * Returns 0 if the date range is invalid.
 */
export function calculateTargetPace(budgetPence: number, startDate: Date, endDate: Date): number {
  const totalDays = daysBetween(startDate, endDate);
  if (totalDays <= 0) return 0;
  return Math.round(budgetPence / totalDays);
}

/**
 * Builds a full burndown projection with ideal, actual, and projected lines.
 *
 * - Ideal: linear drawdown from budget to 0 over the date range.
 * - Actual: remaining budget after cumulative daily spend, one point per day up to currentDate.
 * - Projected: from the current remaining amount, extrapolating at daily pace to end date.
 */
export function calculateBurndownProjection(
  entries: readonly SpendEntry[],
  budgetPence: number,
  startDate: Date,
  endDate: Date,
  currentDate: Date,
): BurndownProjection {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  const current = startOfDay(currentDate);
  const totalDays = daysBetween(start, end);

  if (totalDays <= 0) {
    return {
      idealLine: [],
      actualLine: [],
      projectedLine: [],
      dailyPacePence: 0,
      targetPacePence: 0,
      paceRatio: 0,
      projectedExhaustionDate: null,
    };
  }

  // ── Ideal line: straight drawdown ──
  const idealLine: BurndownDataPoint[] = [];
  for (let d = 0; d <= totalDays; d++) {
    idealLine.push({
      date: addDays(start, d),
      amountPence: Math.round(budgetPence * (1 - d / totalDays)),
    });
  }

  // ── Actual line: cumulative spend subtracted from budget ──
  const dailyTotals = dailySpendTotals(entries);
  const spendByDayMap = new Map<number, number>();
  for (const { date, totalPence } of dailyTotals) {
    spendByDayMap.set(date.getTime(), totalPence);
  }

  const effectiveEnd = current < end ? current : end;
  const daysToPlot = Math.max(daysBetween(start, effectiveEnd), 0);
  const actualLine: BurndownDataPoint[] = [];
  let cumulativeSpend = 0;

  for (let d = 0; d <= daysToPlot; d++) {
    const dayDate = addDays(start, d);
    const daySpend = spendByDayMap.get(dayDate.getTime()) ?? 0;
    cumulativeSpend += daySpend;
    actualLine.push({
      date: dayDate,
      amountPence: budgetPence - cumulativeSpend,
    });
  }

  // ── Pace calculations ──
  const dailyPacePence = calculateDailyPace(entries, start, current);
  const targetPacePence = calculateTargetPace(budgetPence, start, end);
  const paceRatio = targetPacePence > 0 ? dailyPacePence / targetPacePence : 0;

  // ── Projected line: from current point to end date ──
  const projectedLine: BurndownDataPoint[] = [];
  const currentRemaining =
    actualLine.length > 0 ? actualLine[actualLine.length - 1].amountPence : budgetPence;

  if (current < end && dailyPacePence > 0) {
    const daysRemaining = daysBetween(current, end);
    for (let d = 0; d <= daysRemaining; d++) {
      const projected = currentRemaining - dailyPacePence * d;
      projectedLine.push({
        date: addDays(current, d),
        amountPence: Math.max(projected, 0),
      });
      if (projected <= 0) break;
    }
  }

  // ── Projected exhaustion date ──
  let projectedExhaustionDate: Date | null = null;
  if (dailyPacePence > 0) {
    const daysUntilExhaustion = Math.ceil(currentRemaining / dailyPacePence);
    const exhaustionDate = addDays(current, daysUntilExhaustion);
    if (exhaustionDate < end) {
      projectedExhaustionDate = exhaustionDate;
    }
  }

  return {
    idealLine,
    actualLine,
    projectedLine,
    dailyPacePence,
    targetPacePence,
    paceRatio,
    projectedExhaustionDate,
  };
}

/**
 * Detects budget alerts based on burndown projection data.
 */
export function detectAlerts(
  projection: BurndownProjection,
  entries: readonly SpendEntry[],
  endDate: Date,
): BudgetAlert[] {
  const alerts: BudgetAlert[] = [];

  // Over-pace: daily spend exceeds target by 20%+
  if (projection.paceRatio >= OVER_PACE_THRESHOLD) {
    const overPercent = Math.round((projection.paceRatio - 1) * 100);
    alerts.push({
      type: 'over-pace',
      message: `Spending ${overPercent}% over budget pace`,
      severity: 'warning',
    });
  }

  // Projected exhaustion before end date
  if (projection.projectedExhaustionDate !== null) {
    const daysEarly = daysBetween(projection.projectedExhaustionDate, endDate);
    alerts.push({
      type: 'projected-exhaustion',
      message: `Projected to run out of budget ${daysEarly} day${daysEarly === 1 ? '' : 's'} early`,
      severity: 'danger',
    });
  }

  // Single-day spike: any day's spend exceeds 2x target pace
  if (projection.targetPacePence > 0) {
    const spikeThreshold = projection.targetPacePence * SINGLE_DAY_SPIKE_MULTIPLIER;
    const dailyTotals = dailySpendTotals(entries);
    for (const { date, totalPence } of dailyTotals) {
      if (totalPence > spikeThreshold) {
        alerts.push({
          type: 'single-day-spike',
          message: `High spend day on ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
          severity: 'warning',
        });
      }
    }
  }

  return alerts;
}

/**
 * Calculates a trip-wide burndown across all destinations.
 *
 * Uses the earliest destination startDate and latest endDate as the trip range.
 * Total budget = sum of destination allocations.
 * Returns null if no destinations have date ranges.
 */
export function calculateTripBurndown(
  destinations: readonly Destination[],
  allSpend: readonly SpendEntry[],
  currentDate: Date,
): BurndownProjection | null {
  const datedDestinations = destinations.filter(
    (d): d is typeof d & { startDate: Date; endDate: Date } =>
      d.startDate !== null && d.endDate !== null,
  );
  if (datedDestinations.length === 0) return null;

  const earliestStart = new Date(Math.min(...datedDestinations.map((d) => d.startDate.getTime())));
  const latestEnd = new Date(Math.max(...datedDestinations.map((d) => d.endDate.getTime())));
  const totalBudgetPence = datedDestinations.reduce(
    (sum, d) => sum + d.estimatedBudget.amountPence,
    0,
  );

  // Filter spend to only entries belonging to dated destinations
  const datedDestinationIds = new Set(datedDestinations.map((d) => d.id));
  const relevantSpend = allSpend.filter((s) => datedDestinationIds.has(s.destinationId));

  return calculateBurndownProjection(
    relevantSpend,
    totalBudgetPence,
    earliestStart,
    latestEnd,
    currentDate,
  );
}
