'use server';

import { revalidatePath } from 'next/cache';
import { addDestination } from '@/application/use-cases/add-destination';
import { recordSpend } from '@/application/use-cases/record-spend';
import { removeDestination } from '@/application/use-cases/remove-destination';
import type { ComfortLevel, SpendCategory } from '@/domain/trip/types';
import { auth } from '@/infrastructure/auth';
import { db } from '@/infrastructure/db/client';
import { DrizzleDestinationRepository } from '@/infrastructure/db/repositories/drizzle-destination-repository';
import { DrizzleSpendEntryRepository } from '@/infrastructure/db/repositories/drizzle-spend-entry-repository';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';

async function getVerifiedUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');
  return session.user.id;
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

  const destRepo = new DrizzleDestinationRepository(db);
  const result = await addDestination(tripRepo, destRepo, {
    tripId,
    name: name.trim(),
    country: country.trim(),
    estimatedBudgetPence,
    currency: 'GBP',
    comfortLevel: comfortLevel as ComfortLevel,
    startDate: null,
    endDate: null,
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
  await removeDestination(destRepo, destinationId, userId);

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

  const destRepo = new DrizzleDestinationRepository(db);
  const spendRepo = new DrizzleSpendEntryRepository(db);

  const result = await recordSpend(destRepo, spendRepo, {
    destinationId,
    amountPence,
    currency: 'GBP',
    category: category as SpendCategory,
    description: typeof description === 'string' && description.trim() ? description.trim() : null,
    spentAt: new Date(spentAtRaw),
  });

  if (!result.ok) return { error: result.error };

  revalidatePath(`/trips/${tripId}`);
  return { error: null };
}
