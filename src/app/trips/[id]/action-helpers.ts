'use server';

import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type {
  ComfortLevel,
  FixedCostCategory,
  Result,
  SpendCategory,
  Trip,
  TripStatus,
} from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';
import { getAppContainer } from '@/infrastructure/container';
import { getAuthenticatedAccessContext } from '@/infrastructure/organization/active-organization';

const TRIP_STATUSES: readonly TripStatus[] = ['planning', 'active', 'completed'];

export function toTripStatus(v: string): TripStatus | null {
  return (TRIP_STATUSES as readonly string[]).includes(v) ? (v as TripStatus) : null;
}

const SPEND_CATEGORIES: readonly SpendCategory[] = [
  'accommodation',
  'food',
  'transport',
  'activities',
  'shopping',
  'other',
];

const COMFORT_LEVELS: readonly ComfortLevel[] = ['budget', 'mid', 'luxury'];

const FIXED_COST_CATEGORIES: readonly FixedCostCategory[] = [
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
];

export function toFixedCostCategory(v: string): FixedCostCategory | null {
  return (FIXED_COST_CATEGORIES as readonly string[]).includes(v) ? (v as FixedCostCategory) : null;
}

export function toSpendCategory(v: string): SpendCategory | null {
  return (SPEND_CATEGORIES as readonly string[]).includes(v) ? (v as SpendCategory) : null;
}

export function toComfortLevel(v: string): ComfortLevel | null {
  return (COMFORT_LEVELS as readonly string[]).includes(v) ? (v as ComfortLevel) : null;
}

export async function getVerifiedUserId(): Promise<Result<string>> {
  const context = await getAuthenticatedAccessContext();
  if (!context?.userId) return err('Unauthorized');
  if (!context.activeOrganization) return err('No organization membership');
  return ok(context.userId);
}

export async function getAccessibleTrip(
  tripRepo: TripRepository,
  organizationRepo: OrganizationRepository,
  tripId: string,
  userId: string,
): Promise<Trip | null> {
  const trip = await tripRepo.findById(tripId);
  if (!trip) return null;

  const membership = await organizationRepo.findMembership(trip.organizationId, userId);
  if (!membership) return null;
  return trip;
}

/** Parses an optional ISO date string (YYYY-MM-DD) from a form field. Returns null if absent. */
export function parseDateField(value: FormDataEntryValue | null): Date | null {
  if (!value || typeof value !== 'string' || value.trim() === '') return null;
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getContainer() {
  return getAppContainer();
}
