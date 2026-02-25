'use server';

import { revalidatePath } from 'next/cache';
import { addDestination } from '@/application/use-cases/add-destination';
import { addFixedCost } from '@/application/use-cases/add-fixed-cost';
import { deleteSpendEntry } from '@/application/use-cases/delete-spend-entry';
import { editDestination } from '@/application/use-cases/edit-destination';
import { editSpendEntry } from '@/application/use-cases/edit-spend-entry';
import { recordSpend } from '@/application/use-cases/record-spend';
import { removeDestination } from '@/application/use-cases/remove-destination';
import { removeFixedCost } from '@/application/use-cases/remove-fixed-cost';
import type { ComfortLevel, SpendCategory } from '@/domain/trip/types';

const SPEND_CATEGORIES: readonly SpendCategory[] = [
  'accommodation',
  'food',
  'transport',
  'activities',
  'shopping',
  'other',
];

const COMFORT_LEVELS: readonly ComfortLevel[] = ['budget', 'mid', 'luxury'];

function toSpendCategory(v: string): SpendCategory | null {
  return (SPEND_CATEGORIES as readonly string[]).includes(v) ? (v as SpendCategory) : null;
}

function toComfortLevel(v: string): ComfortLevel | null {
  return (COMFORT_LEVELS as readonly string[]).includes(v) ? (v as ComfortLevel) : null;
}
import { auth } from '@/infrastructure/auth';
import { db } from '@/infrastructure/db/client';
import { DrizzleDestinationRepository } from '@/infrastructure/db/repositories/drizzle-destination-repository';
import { DrizzleSpendEntryRepository } from '@/infrastructure/db/repositories/drizzle-spend-entry-repository';
import { DrizzleTripFixedCostRepository } from '@/infrastructure/db/repositories/drizzle-trip-fixed-cost-repository';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';

async function getVerifiedUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  return session.user.id;
}

/** Parses an optional ISO date string (YYYY-MM-DD) from a form field. Returns null if absent. */
function parseDateField(value: FormDataEntryValue | null): Date | null {
  if (!value || typeof value !== 'string' || value.trim() === '') return null;
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

// ─── Fixed cost actions ───────────────────────────────────────────────────────

export type FixedCostState = { error: string | null };

export async function addFixedCostAction(
  tripId: string,
  _prev: FixedCostState,
  formData: FormData,
): Promise<FixedCostState> {
  const userId = await getVerifiedUserId();

  const tripRepo = new DrizzleTripRepository(db);
  const trip = await tripRepo.findById(tripId);
  if (!trip || trip.ownerId !== userId) return { error: 'Trip not found' };

  const label = formData.get('label');
  const amountPounds = formData.get('amountPounds');

  if (typeof label !== 'string' || typeof amountPounds !== 'string') {
    return { error: 'Invalid form data' };
  }
  if (!label.trim()) return { error: 'Label is required' };

  const amountPence = Math.round(Number.parseFloat(amountPounds) * 100);
  if (Number.isNaN(amountPence) || amountPence <= 0) {
    return { error: 'Invalid amount' };
  }

  const fixedCostRepo = new DrizzleTripFixedCostRepository(db);
  const result = await addFixedCost(tripRepo, fixedCostRepo, {
    tripId,
    label: label.trim(),
    amountPence,
    currency: 'GBP', // GBP-only: see ADR 011
  });

  if (!result.ok) return { error: result.error };
  revalidatePath(`/trips/${tripId}`);
  return { error: null };
}

export async function removeFixedCostAction(tripId: string, fixedCostId: string): Promise<void> {
  const userId = await getVerifiedUserId();

  const tripRepo = new DrizzleTripRepository(db);
  const trip = await tripRepo.findById(tripId);
  if (!trip || trip.ownerId !== userId) throw new Error('Forbidden');

  const fixedCostRepo = new DrizzleTripFixedCostRepository(db);
  await removeFixedCost(fixedCostRepo, fixedCostId);

  revalidatePath(`/trips/${tripId}`);
}

// ─── Destination actions ──────────────────────────────────────────────────────

export type AddDestinationState = { error: string | null };

export async function addDestinationAction(
  tripId: string,
  _prev: AddDestinationState,
  formData: FormData,
): Promise<AddDestinationState> {
  const userId = await getVerifiedUserId();

  const tripRepo = new DrizzleTripRepository(db);
  const trip = await tripRepo.findById(tripId);
  if (!trip || trip.ownerId !== userId) return { error: 'Trip not found' };

  const name = formData.get('name');
  const country = formData.get('country');
  const estimatedBudgetPounds = formData.get('estimatedBudgetPounds');
  const comfortLevel = formData.get('comfortLevel');

  if (
    typeof name !== 'string' ||
    typeof country !== 'string' ||
    typeof estimatedBudgetPounds !== 'string' ||
    typeof comfortLevel !== 'string'
  ) {
    return { error: 'Invalid form data' };
  }

  const estimatedBudgetPence = Math.round(Number.parseFloat(estimatedBudgetPounds) * 100);
  if (Number.isNaN(estimatedBudgetPence) || estimatedBudgetPence <= 0) {
    return { error: 'Invalid budget amount' };
  }

  const level = toComfortLevel(comfortLevel);
  if (!level) return { error: 'Invalid comfort level' };

  const startDate = parseDateField(formData.get('startDate'));
  const endDate = parseDateField(formData.get('endDate'));

  const destRepo = new DrizzleDestinationRepository(db);
  const fixedCostRepo = new DrizzleTripFixedCostRepository(db);
  const result = await addDestination(tripRepo, destRepo, fixedCostRepo, {
    tripId,
    name: name.trim(),
    country: country.trim(),
    estimatedBudgetPence,
    currency: 'GBP', // GBP-only: see ADR 011
    comfortLevel: level,
    startDate,
    endDate,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath(`/trips/${tripId}`);
  return { error: null };
}

export type EditDestinationState = { error: string | null };

export async function editDestinationAction(
  tripId: string,
  destinationId: string,
  _prev: EditDestinationState,
  formData: FormData,
): Promise<EditDestinationState> {
  const userId = await getVerifiedUserId();

  const tripRepo = new DrizzleTripRepository(db);
  const trip = await tripRepo.findById(tripId);
  if (!trip || trip.ownerId !== userId) return { error: 'Trip not found' };

  const name = formData.get('name');
  const country = formData.get('country');
  const estimatedBudgetPounds = formData.get('estimatedBudgetPounds');
  const comfortLevel = formData.get('comfortLevel');

  if (
    typeof name !== 'string' ||
    typeof country !== 'string' ||
    typeof estimatedBudgetPounds !== 'string' ||
    typeof comfortLevel !== 'string'
  ) {
    return { error: 'Invalid form data' };
  }
  if (!name.trim()) return { error: 'Name is required' };
  if (!country.trim()) return { error: 'Country is required' };

  const estimatedBudgetPence = Math.round(Number.parseFloat(estimatedBudgetPounds) * 100);
  if (Number.isNaN(estimatedBudgetPence) || estimatedBudgetPence <= 0) {
    return { error: 'Invalid budget amount' };
  }

  const level = toComfortLevel(comfortLevel);
  if (!level) return { error: 'Invalid comfort level' };

  const startDate = parseDateField(formData.get('startDate'));
  const endDate = parseDateField(formData.get('endDate'));

  const destRepo = new DrizzleDestinationRepository(db);
  const fixedCostRepo = new DrizzleTripFixedCostRepository(db);
  const result = await editDestination(tripRepo, destRepo, fixedCostRepo, {
    destinationId,
    tripId,
    name: name.trim(),
    country: country.trim(),
    estimatedBudgetPence,
    currency: 'GBP', // GBP-only: see ADR 011
    comfortLevel: level,
    startDate,
    endDate,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath(`/trips/${tripId}`);
  return { error: null };
}

export async function removeDestinationAction(
  tripId: string,
  destinationId: string,
): Promise<void> {
  const userId = await getVerifiedUserId();

  const tripRepo = new DrizzleTripRepository(db);
  const trip = await tripRepo.findById(tripId);
  if (!trip || trip.ownerId !== userId) throw new Error('Forbidden');

  const destRepo = new DrizzleDestinationRepository(db);
  await removeDestination(destRepo, destinationId);

  revalidatePath(`/trips/${tripId}`);
}

// ─── Spend actions ────────────────────────────────────────────────────────────

export type RecordSpendState = { error: string | null };

export async function recordSpendAction(
  tripId: string,
  destinationId: string,
  _prev: RecordSpendState,
  formData: FormData,
): Promise<RecordSpendState> {
  const userId = await getVerifiedUserId();

  const tripRepo = new DrizzleTripRepository(db);
  const trip = await tripRepo.findById(tripId);
  if (!trip || trip.ownerId !== userId) return { error: 'Trip not found' };

  const amountPounds = formData.get('amountPounds');
  const category = formData.get('category');
  const description = formData.get('description');
  const spentAtRaw = formData.get('spentAt');

  if (
    typeof amountPounds !== 'string' ||
    typeof category !== 'string' ||
    typeof spentAtRaw !== 'string'
  ) {
    return { error: 'Invalid form data' };
  }

  const amountPence = Math.round(Number.parseFloat(amountPounds) * 100);
  if (Number.isNaN(amountPence) || amountPence <= 0) {
    return { error: 'Invalid amount' };
  }

  const spendCategory = toSpendCategory(category);
  if (!spendCategory) return { error: 'Invalid category' };

  const destRepo = new DrizzleDestinationRepository(db);
  const spendRepo = new DrizzleSpendEntryRepository(db);
  const result = await recordSpend(destRepo, spendRepo, {
    destinationId,
    amountPence,
    currency: 'GBP', // GBP-only: see ADR 011
    category: spendCategory,
    description: typeof description === 'string' && description.trim() ? description.trim() : null,
    spentAt: new Date(spentAtRaw),
  });

  if (!result.ok) return { error: result.error };
  revalidatePath(`/trips/${tripId}`);
  return { error: null };
}

// ─── Spend entry management actions ──────────────────────────────────────────

export async function deleteSpendEntryAction(tripId: string, entryId: string): Promise<void> {
  const userId = await getVerifiedUserId();

  const tripRepo = new DrizzleTripRepository(db);
  const trip = await tripRepo.findById(tripId);
  if (!trip || trip.ownerId !== userId) throw new Error('Forbidden');

  const spendRepo = new DrizzleSpendEntryRepository(db);
  await deleteSpendEntry(spendRepo, entryId);

  revalidatePath(`/trips/${tripId}`);
}

export type EditSpendEntryState = { error: string | null };

export async function editSpendEntryAction(
  tripId: string,
  entryId: string,
  _prev: EditSpendEntryState,
  formData: FormData,
): Promise<EditSpendEntryState> {
  const userId = await getVerifiedUserId();

  const tripRepo = new DrizzleTripRepository(db);
  const trip = await tripRepo.findById(tripId);
  if (!trip || trip.ownerId !== userId) return { error: 'Trip not found' };

  const amountPounds = formData.get('amountPounds');
  const category = formData.get('category');
  const description = formData.get('description');
  const spentAtRaw = formData.get('spentAt');

  if (
    typeof amountPounds !== 'string' ||
    typeof category !== 'string' ||
    typeof spentAtRaw !== 'string'
  ) {
    return { error: 'Invalid form data' };
  }

  const amountPence = Math.round(Number.parseFloat(amountPounds) * 100);
  if (Number.isNaN(amountPence) || amountPence <= 0) {
    return { error: 'Invalid amount' };
  }

  const spendCategory = toSpendCategory(category);
  if (!spendCategory) return { error: 'Invalid category' };

  const spendRepo = new DrizzleSpendEntryRepository(db);
  const result = await editSpendEntry(spendRepo, {
    entryId,
    amountPence,
    currency: 'GBP', // GBP-only: see ADR 011
    category: spendCategory,
    description: typeof description === 'string' && description.trim() ? description.trim() : null,
    spentAt: new Date(spentAtRaw),
  });

  if (!result.ok) return { error: result.error };
  revalidatePath(`/trips/${tripId}`);
  return { error: null };
}
