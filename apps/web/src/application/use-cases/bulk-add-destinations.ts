import { nextSortOrder, validateNewDestination } from '@/domain/destination/destination';
import type { DestinationRepository } from '@/domain/destination/destination-repository';
import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { ComfortLevel, Currency, Destination } from '@/domain/trip/types';
import { money } from '@/domain/trip/types';

export type BulkDestinationCandidate = {
  readonly name: string;
  readonly country: string;
  readonly city: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly estimatedBudgetPence: number;
  readonly currency: Currency;
  readonly comfortLevel: ComfortLevel;
  readonly startDate: Date | null;
  readonly endDate: Date | null;
};

export type BulkAddRowError = {
  readonly index: number;
  readonly error: string;
};

export type BulkAddResult =
  | { readonly ok: true; readonly saved: readonly Destination[] }
  | { readonly ok: false; readonly errors: readonly BulkAddRowError[] };

export async function bulkAddDestinations(
  tripRepo: TripRepository,
  destRepo: DestinationRepository,
  fixedCostRepo: TripFixedCostRepository,
  tripId: string,
  candidates: readonly BulkDestinationCandidate[],
): Promise<BulkAddResult> {
  if (candidates.length === 0) {
    return { ok: true, saved: [] };
  }

  const trip = await tripRepo.findById(tripId);
  if (!trip) {
    return { ok: false, errors: [{ index: -1, error: `Trip not found: ${tripId}` }] };
  }

  const [existing, fixedCosts] = await Promise.all([
    destRepo.findByTrip(tripId),
    fixedCostRepo.findByTrip(tripId),
  ]);

  const now = new Date();
  const accepted: Destination[] = [];
  const errors: BulkAddRowError[] = [];

  let nextSort = nextSortOrder(existing);

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];

    if (!c.country.trim()) {
      errors.push({ index: i, error: 'Country is required' });
      continue;
    }

    const budget = money(c.estimatedBudgetPence, c.currency);
    if (!budget.ok) {
      errors.push({ index: i, error: budget.error });
      continue;
    }

    const candidate: Destination = {
      id: crypto.randomUUID(),
      tripId,
      name: c.name.trim() || c.city?.trim() || c.country.trim(),
      country: c.country.trim(),
      city: c.city?.trim() || null,
      latitude: c.latitude,
      longitude: c.longitude,
      estimatedBudget: budget.value,
      comfortLevel: c.comfortLevel,
      startDate: c.startDate,
      endDate: c.endDate,
      sortOrder: nextSort++,
      createdAt: now,
      updatedAt: now,
    };

    const validation = validateNewDestination(
      trip,
      [...existing, ...accepted],
      fixedCosts,
      candidate,
    );
    if (!validation.ok) {
      errors.push({ index: i, error: validation.error });
      continue;
    }
    accepted.push(candidate);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const saved: Destination[] = [];
  for (const candidate of accepted) {
    saved.push(await destRepo.save(candidate));
  }
  return { ok: true, saved };
}
