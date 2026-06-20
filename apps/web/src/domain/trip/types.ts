// ─── Value Objects ─────────────────────────────────────────────────────────────

export type Currency = 'GBP' | 'USD' | 'EUR' | 'AUD';

export type Money = {
  readonly amountPence: number; // stored as integer pence/cents — never float
  readonly currency: Currency;
};

export function money(amountPence: number, currency: Currency = 'GBP'): Result<Money> {
  if (!Number.isInteger(amountPence)) {
    return err(`Money amount must be an integer (pence), got: ${amountPence}`);
  }
  return ok({ amountPence, currency });
}

/**
 * Construct Money without validation — for trusted contexts where pence are
 * known-integer (DB rows, arithmetic on existing Money values, test fixtures).
 */
export function moneyUnchecked(amountPence: number, currency: Currency = 'GBP'): Money {
  return { amountPence, currency };
}

export function addMoney(a: Money, b: Money): Result<Money> {
  if (a.currency !== b.currency) {
    return err(`Cannot add money with different currencies: ${a.currency} and ${b.currency}`);
  }
  return ok(moneyUnchecked(a.amountPence + b.amountPence, a.currency));
}

/**
 * Add two Money values without validation — for trusted contexts where
 * currencies are known to match.
 */
export function addMoneyUnchecked(a: Money, b: Money): Money {
  return moneyUnchecked(a.amountPence + b.amountPence, a.currency);
}

export function formatMoney(m: Money): string {
  const symbol = currencySymbol(m.currency);
  const pounds = (m.amountPence / 100).toFixed(2);
  return `${symbol}${pounds}`;
}

function currencySymbol(currency: Currency): string {
  const symbols: Record<Currency, string> = {
    GBP: '£',
    USD: '$',
    EUR: '€',
    AUD: 'A$',
  };
  return symbols[currency];
}

// ─── Enums ─────────────────────────────────────────────────────────────────────

export type ComfortLevel = 'budget' | 'mid' | 'luxury';

export type TripStatus = 'planning' | 'active' | 'completed';

/** What the traveller intends to do on a trip — drives visa-rule selection. */
export type TripIntent = 'tourism' | 'working-holiday' | 'long-stay';

export const TRIP_INTENTS: readonly TripIntent[] = ['tourism', 'working-holiday', 'long-stay'];

export function isTripIntent(value: unknown): value is TripIntent {
  return typeof value === 'string' && (TRIP_INTENTS as readonly string[]).includes(value);
}

export type SpendCategory =
  | 'accommodation'
  | 'food'
  | 'transport'
  | 'activities'
  | 'shopping'
  | 'other';

export type FixedCostCategory =
  | 'accommodation'
  | 'activities'
  | 'bills'
  | 'eating-out'
  | 'fuel'
  | 'groceries'
  | 'healthcare'
  | 'insurance'
  | 'shopping'
  | 'subscriptions'
  | 'transport'
  | 'visas'
  | 'other';

// ─── Entities ──────────────────────────────────────────────────────────────────

export type Trip = {
  readonly id: string;
  readonly organizationId: string;
  readonly ownerId: string;
  readonly name: string;
  readonly totalBudget: Money;
  readonly status: TripStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/**
 * A named fixed cost deducted from the trip budget before destination allocations.
 * Examples: flights, travel insurance, ongoing subscriptions (phone, streaming).
 * Users enter the pre-calculated total — there is no built-in recurring multiplier.
 */
export type TripFixedCost = {
  readonly id: string;
  readonly tripId: string;
  readonly label: string;
  readonly amount: Money;
  readonly category: FixedCostCategory;
  readonly date: Date;
  readonly sortOrder: number;
  readonly createdAt: Date;
};

export type Coordinates = {
  readonly latitude: number;
  readonly longitude: number;
};

export type Destination = {
  readonly id: string;
  readonly tripId: string;
  readonly name: string;
  readonly country: string;
  readonly city: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly estimatedBudget: Money;
  readonly comfortLevel: ComfortLevel;
  readonly startDate: Date | null;
  readonly endDate: Date | null;
  readonly sortOrder: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type SpendEntry = {
  readonly id: string;
  readonly destinationId: string;
  readonly amount: Money;
  readonly category: SpendCategory;
  readonly description: string | null;
  readonly spentAt: Date;
  readonly createdAt: Date;
};

// ─── Journey map types ────────────────────────────────────────────────────────

export type WaterfallStop = {
  readonly type: 'fixed-costs' | 'destination';
  readonly label: string;
  readonly destinationId: string | null;
  readonly allocatedPence: number;
  readonly spentPence: number;
  readonly runningTotalPence: number;
  readonly isOverBudget: boolean;
  readonly coordinates: Coordinates | null;
  readonly startDate: Date | null;
  readonly endDate: Date | null;
};

export type BudgetWaterfall = {
  readonly startingBudgetPence: number;
  readonly stops: readonly WaterfallStop[];
  readonly unallocatedPence: number;
};

// ─── Result type ──────────────────────────────────────────────────────────────

export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<E = string>(error: E): Result<never, E> {
  return { ok: false, error };
}
