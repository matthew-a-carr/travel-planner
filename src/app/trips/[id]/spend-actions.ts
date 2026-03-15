'use server';

import { revalidatePath } from 'next/cache';
import { deleteSpendEntry } from '@/application/use-cases/delete-spend-entry';
import { editSpendEntry } from '@/application/use-cases/edit-spend-entry';
import { recordSpend } from '@/application/use-cases/record-spend';
import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';
import {
  getAccessibleTrip,
  getContainer,
  getVerifiedUserId,
  toSpendCategory,
} from './action-helpers';

const {
  tripRepository: tripRepo,
  organizationRepository: organizationRepo,
  destinationRepository: destRepo,
  spendEntryRepository: spendRepo,
} = getContainer();

export type RecordSpendState = { error: string | null };

export async function recordSpendAction(
  tripId: string,
  destinationId: string,
  _prev: RecordSpendState,
  formData: FormData,
): Promise<RecordSpendState> {
  const userResult = await getVerifiedUserId();
  if (!userResult.ok) return { error: userResult.error };

  const trip = await getAccessibleTrip(tripRepo, organizationRepo, tripId, userResult.value);
  if (!trip) return { error: 'Trip not found' };

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

export async function deleteSpendEntryAction(
  tripId: string,
  entryId: string,
): Promise<Result<void>> {
  const userResult = await getVerifiedUserId();
  if (!userResult.ok) return userResult;

  const trip = await getAccessibleTrip(tripRepo, organizationRepo, tripId, userResult.value);
  if (!trip) return err('Forbidden');

  await deleteSpendEntry(spendRepo, entryId);

  revalidatePath(`/trips/${tripId}`);
  return ok(undefined);
}

export type EditSpendEntryState = { error: string | null };

export async function editSpendEntryAction(
  tripId: string,
  entryId: string,
  _prev: EditSpendEntryState,
  formData: FormData,
): Promise<EditSpendEntryState> {
  const userResult = await getVerifiedUserId();
  if (!userResult.ok) return { error: userResult.error };

  const trip = await getAccessibleTrip(tripRepo, organizationRepo, tripId, userResult.value);
  if (!trip) return { error: 'Trip not found' };

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
