'use server';

import { redirect } from 'next/navigation';
import type { BulkDestinationCandidate } from '@/application/use-cases/bulk-add-destinations';
import { createTrip } from '@/application/use-cases/create-trip';
import { createTripWithDestinations } from '@/application/use-cases/create-trip-with-destinations';
import { parseItineraryText } from '@/application/use-cases/parse-itinerary-text';
import type { ParsedItineraryResult } from '@/domain/timeline/types';
import { suggestTripBudgetPence, suggestTripName } from '@/domain/trip/trip-suggestion';
import type { ComfortLevel, Currency } from '@/domain/trip/types';
import { getAppContainer } from '@/infrastructure/container';
import { getAuthenticatedAccessContext } from '@/infrastructure/organization/active-organization';

const COMFORT_LEVELS: readonly ComfortLevel[] = ['budget', 'mid', 'luxury'];
const CURRENCIES: readonly Currency[] = ['GBP', 'USD', 'EUR', 'AUD'];

export type CreateTripState = { error: string | null };

export async function createTripAction(
  _prev: CreateTripState,
  formData: FormData,
): Promise<CreateTripState> {
  const context = await getAuthenticatedAccessContext();
  if (!context) return { error: 'Unauthorized' };
  if (!context.activeOrganization) return { error: 'Join an organization first' };

  const name = formData.get('name');
  const totalBudgetPounds = formData.get('totalBudgetPounds');

  if (typeof name !== 'string' || typeof totalBudgetPounds !== 'string') {
    return { error: 'Invalid form data' };
  }
  if (!name.trim()) return { error: 'Trip name is required' };

  const totalBudgetPence = Math.round(Number.parseFloat(totalBudgetPounds) * 100);
  if (Number.isNaN(totalBudgetPence) || totalBudgetPence <= 0) {
    return { error: 'Invalid budget value' };
  }

  const { tripRepository } = getAppContainer();
  const result = await createTrip(tripRepository, {
    organizationId: context.activeOrganization.organization.id,
    ownerId: context.userId,
    name: name.trim(),
    totalBudgetPence,
    currency: 'GBP' as Currency, // GBP-only: see ADR 011
  });

  if (!result.ok) return { error: result.error };
  redirect(`/trips/${result.value.id}`);
}

// ─── AI-assisted create flow (paste a paragraph → trip + destinations) ──────

export type PlanTripFromTextState = {
  readonly error: string | null;
  readonly result:
    | (ParsedItineraryResult & {
        readonly suggestedName: string;
        readonly suggestedBudgetPence: number | null;
      })
    | null;
};

export async function planTripFromTextAction(
  _prev: PlanTripFromTextState,
  formData: FormData,
): Promise<PlanTripFromTextState> {
  const text = formData.get('text');
  if (typeof text !== 'string') {
    return { error: 'Invalid form data', result: null };
  }

  const context = await getAuthenticatedAccessContext();
  if (!context?.userId) return { error: 'Unauthorized', result: null };
  if (!context.activeOrganization) {
    return { error: 'Join an organization first', result: null };
  }

  const { tripRepository, countryReferenceRepository, itineraryParser, aiCacheRepository, hashFn } =
    getAppContainer();

  const parsed = await parseItineraryText(
    tripRepository,
    countryReferenceRepository,
    itineraryParser,
    aiCacheRepository,
    hashFn,
    { text },
  );

  if (!parsed.ok) return { error: parsed.error, result: null };

  return {
    error: null,
    result: {
      ...parsed.value,
      suggestedName: suggestTripName(parsed.value.rows),
      suggestedBudgetPence: suggestTripBudgetPence(parsed.value.rows),
    },
  };
}

type SerialisedCandidate = {
  readonly name: string;
  readonly country: string;
  readonly city: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly estimatedBudgetPence: number;
  readonly currency: string;
  readonly comfortLevel: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
};

function toCandidate(c: SerialisedCandidate): BulkDestinationCandidate | string {
  if (!c.country.trim()) return 'Country is required';
  if (!Number.isInteger(c.estimatedBudgetPence) || c.estimatedBudgetPence < 0) {
    return 'Estimated budget must be a non-negative integer (pence)';
  }
  if (!COMFORT_LEVELS.includes(c.comfortLevel as ComfortLevel)) {
    return `Invalid comfort level: ${c.comfortLevel}`;
  }
  if (!CURRENCIES.includes(c.currency as Currency)) {
    return `Invalid currency: ${c.currency}`;
  }
  const start = c.startDate ? new Date(`${c.startDate}T00:00:00Z`) : null;
  const end = c.endDate ? new Date(`${c.endDate}T00:00:00Z`) : null;
  return {
    name: c.name,
    country: c.country,
    city: c.city,
    latitude: c.latitude,
    longitude: c.longitude,
    estimatedBudgetPence: c.estimatedBudgetPence,
    currency: c.currency as Currency,
    comfortLevel: c.comfortLevel as ComfortLevel,
    startDate: start,
    endDate: end,
  };
}

export async function createTripFromPlanAction(
  _prev: CreateTripState,
  formData: FormData,
): Promise<CreateTripState> {
  const context = await getAuthenticatedAccessContext();
  if (!context) return { error: 'Unauthorized' };
  if (!context.activeOrganization) return { error: 'Join an organization first' };

  const name = formData.get('name');
  const totalBudgetPounds = formData.get('totalBudgetPounds');
  const candidatesJson = formData.get('candidates');

  if (
    typeof name !== 'string' ||
    typeof totalBudgetPounds !== 'string' ||
    typeof candidatesJson !== 'string'
  ) {
    return { error: 'Invalid form data' };
  }
  if (!name.trim()) return { error: 'Trip name is required' };

  const totalBudgetPence = Math.round(Number.parseFloat(totalBudgetPounds) * 100);
  if (Number.isNaN(totalBudgetPence) || totalBudgetPence <= 0) {
    return { error: 'Invalid budget value' };
  }

  let rawCandidates: unknown;
  try {
    rawCandidates = JSON.parse(candidatesJson);
  } catch {
    return { error: 'Could not parse destinations' };
  }
  if (!Array.isArray(rawCandidates)) return { error: 'Destinations payload must be an array' };

  const candidates: BulkDestinationCandidate[] = [];
  for (let i = 0; i < rawCandidates.length; i++) {
    const result = toCandidate(rawCandidates[i] as SerialisedCandidate);
    if (typeof result === 'string') {
      return { error: `Destination ${i + 1}: ${result}` };
    }
    candidates.push(result);
  }

  const { tripRepository, destinationRepository, tripFixedCostRepository } = getAppContainer();

  const outcome = await createTripWithDestinations(
    tripRepository,
    destinationRepository,
    tripFixedCostRepository,
    {
      organizationId: context.activeOrganization.organization.id,
      ownerId: context.userId,
      name: name.trim(),
      totalBudgetPence,
      currency: 'GBP' as Currency, // GBP-only: see ADR 011
      candidates,
    },
  );

  if (!outcome.ok) {
    const detail = outcome.bulkErrors?.[0]
      ? `${outcome.error} (${outcome.bulkErrors[0].error})`
      : outcome.error;
    return { error: detail };
  }

  redirect(`/trips/${outcome.trip.id}`);
}
