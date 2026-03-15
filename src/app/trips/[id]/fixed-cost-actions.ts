'use server';

import { revalidatePath } from 'next/cache';
import { addFixedCost } from '@/application/use-cases/add-fixed-cost';
import { editFixedCost } from '@/application/use-cases/edit-fixed-cost';
import { removeFixedCost } from '@/application/use-cases/remove-fixed-cost';
import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';
import {
  getAccessibleTrip,
  getContainer,
  getVerifiedUserId,
  parseDateField,
  toFixedCostCategory,
} from './action-helpers';

const {
  tripRepository: tripRepo,
  organizationRepository: organizationRepo,
  tripFixedCostRepository: fixedCostRepo,
} = getContainer();

export type FixedCostState = { error: string | null };

export async function addFixedCostAction(
  tripId: string,
  _prev: FixedCostState,
  formData: FormData,
): Promise<FixedCostState> {
  const userResult = await getVerifiedUserId();
  if (!userResult.ok) return { error: userResult.error };

  const trip = await getAccessibleTrip(tripRepo, organizationRepo, tripId, userResult.value);
  if (!trip) return { error: 'Trip not found' };

  const label = formData.get('label');
  const amountPounds = formData.get('amountPounds');
  const categoryRaw = formData.get('category');
  const dateRaw = formData.get('date');

  if (typeof label !== 'string' || typeof amountPounds !== 'string') {
    return { error: 'Invalid form data' };
  }
  if (!label.trim()) return { error: 'Label is required' };

  const amountPence = Math.round(Number.parseFloat(amountPounds) * 100);
  if (Number.isNaN(amountPence) || amountPence <= 0) {
    return { error: 'Invalid amount' };
  }

  const category = typeof categoryRaw === 'string' ? toFixedCostCategory(categoryRaw) : null;
  if (!category) return { error: 'Invalid category' };

  const date = parseDateField(dateRaw) ?? new Date();

  const result = await addFixedCost(tripRepo, fixedCostRepo, {
    tripId,
    label: label.trim(),
    amountPence,
    currency: 'GBP', // GBP-only: see ADR 011
    category,
    date,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath(`/trips/${tripId}`);
  return { error: null };
}

export async function removeFixedCostAction(
  tripId: string,
  fixedCostId: string,
): Promise<Result<void>> {
  const userResult = await getVerifiedUserId();
  if (!userResult.ok) return userResult;

  const trip = await getAccessibleTrip(tripRepo, organizationRepo, tripId, userResult.value);
  if (!trip) return err('Forbidden');

  await removeFixedCost(fixedCostRepo, fixedCostId);

  revalidatePath(`/trips/${tripId}`);
  return ok(undefined);
}

export type EditFixedCostState = { error: string | null };

export async function editFixedCostAction(
  tripId: string,
  fixedCostId: string,
  _prev: EditFixedCostState,
  formData: FormData,
): Promise<EditFixedCostState> {
  const userResult = await getVerifiedUserId();
  if (!userResult.ok) return { error: userResult.error };

  const trip = await getAccessibleTrip(tripRepo, organizationRepo, tripId, userResult.value);
  if (!trip) return { error: 'Trip not found' };

  const label = formData.get('label');
  const amountPounds = formData.get('amountPounds');
  const categoryRaw = formData.get('category');
  const dateRaw = formData.get('date');

  if (
    typeof label !== 'string' ||
    typeof amountPounds !== 'string' ||
    typeof categoryRaw !== 'string'
  ) {
    return { error: 'Invalid form data' };
  }
  if (!label.trim()) return { error: 'Label is required' };

  const amountPence = Math.round(Number.parseFloat(amountPounds) * 100);
  if (Number.isNaN(amountPence) || amountPence <= 0) {
    return { error: 'Invalid amount' };
  }

  const category = toFixedCostCategory(categoryRaw);
  if (!category) return { error: 'Invalid category' };

  const date = parseDateField(dateRaw);
  if (!date) return { error: 'Date is required' };

  const result = await editFixedCost(fixedCostRepo, {
    fixedCostId,
    label: label.trim(),
    amountPence,
    currency: 'GBP', // GBP-only: see ADR 011
    category,
    date,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath(`/trips/${tripId}`);
  return { error: null };
}
