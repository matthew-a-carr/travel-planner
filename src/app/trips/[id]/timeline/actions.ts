'use server';

import { revalidatePath } from 'next/cache';
import {
  type BulkDestinationCandidate,
  bulkAddDestinations,
} from '@/application/use-cases/bulk-add-destinations';
import { parseItineraryText } from '@/application/use-cases/parse-itinerary-text';
import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import type { ParsedItineraryResult } from '@/domain/timeline/types';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { ComfortLevel, Currency, Trip } from '@/domain/trip/types';
import { getAppContainer } from '@/infrastructure/container';
import { getAuthenticatedAccessContext } from '@/infrastructure/organization/active-organization';

const COMFORT_LEVELS: readonly ComfortLevel[] = ['budget', 'mid', 'luxury'];
const CURRENCIES: readonly Currency[] = ['GBP', 'USD', 'EUR', 'AUD'];

async function getAccessibleTrip(
  tripRepo: TripRepository,
  orgRepo: OrganizationRepository,
  tripId: string,
  userId: string,
): Promise<Trip | null> {
  const trip = await tripRepo.findById(tripId);
  if (!trip) return null;
  const membership = await orgRepo.findMembership(trip.organizationId, userId);
  if (!membership) return null;
  return trip;
}

export type ParseItineraryState = {
  readonly error: string | null;
  readonly result: ParsedItineraryResult | null;
};

const initialParseState: ParseItineraryState = { error: null, result: null };

export { initialParseState };

export async function parseItineraryAction(
  tripId: string,
  _prev: ParseItineraryState,
  formData: FormData,
): Promise<ParseItineraryState> {
  const text = formData.get('text');
  if (typeof text !== 'string') {
    return { error: 'Invalid form data', result: null };
  }

  const context = await getAuthenticatedAccessContext();
  if (!context?.userId) return { error: 'Unauthorized', result: null };

  const {
    tripRepository,
    organizationRepository,
    countryReferenceRepository,
    itineraryParser,
    aiCacheRepository,
    hashFn,
  } = getAppContainer();

  const trip = await getAccessibleTrip(
    tripRepository,
    organizationRepository,
    tripId,
    context.userId,
  );
  if (!trip) return { error: 'Trip not found', result: null };

  const parsed = await parseItineraryText(
    tripRepository,
    countryReferenceRepository,
    itineraryParser,
    aiCacheRepository,
    hashFn,
    { tripId, text },
  );

  if (!parsed.ok) return { error: parsed.error, result: null };
  return { error: null, result: parsed.value };
}

export type ApplyItineraryState = {
  readonly error: string | null;
  readonly addedCount: number;
};

const initialApplyState: ApplyItineraryState = { error: null, addedCount: 0 };

export { initialApplyState };

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

export async function applyParsedItineraryAction(
  tripId: string,
  _prev: ApplyItineraryState,
  formData: FormData,
): Promise<ApplyItineraryState> {
  const json = formData.get('candidates');
  if (typeof json !== 'string') return { error: 'Invalid form data', addedCount: 0 };

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { error: 'Could not parse candidate rows', addedCount: 0 };
  }
  if (!Array.isArray(raw)) return { error: 'Candidate payload must be an array', addedCount: 0 };

  const candidates: BulkDestinationCandidate[] = [];
  for (let i = 0; i < raw.length; i++) {
    const result = toCandidate(raw[i] as SerialisedCandidate);
    if (typeof result === 'string') {
      return { error: `Row ${i + 1}: ${result}`, addedCount: 0 };
    }
    candidates.push(result);
  }

  const context = await getAuthenticatedAccessContext();
  if (!context?.userId) return { error: 'Unauthorized', addedCount: 0 };

  const { tripRepository, organizationRepository, destinationRepository, tripFixedCostRepository } =
    getAppContainer();

  const trip = await getAccessibleTrip(
    tripRepository,
    organizationRepository,
    tripId,
    context.userId,
  );
  if (!trip) return { error: 'Trip not found', addedCount: 0 };

  const result = await bulkAddDestinations(
    tripRepository,
    destinationRepository,
    tripFixedCostRepository,
    tripId,
    candidates,
  );

  if (!result.ok) {
    const first = result.errors[0];
    return {
      error: `Row ${first.index + 1}: ${first.error}`,
      addedCount: 0,
    };
  }

  revalidatePath(`/trips/${tripId}`);
  revalidatePath(`/trips/${tripId}/timeline`);
  return { error: null, addedCount: result.saved.length };
}
