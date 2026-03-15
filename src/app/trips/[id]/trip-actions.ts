'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { deleteTrip } from '@/application/use-cases/delete-trip';
import { editTrip } from '@/application/use-cases/edit-trip';
import { moveTripToOrganization } from '@/application/use-cases/move-trip-to-organization';
import { getAccessibleTrip, getContainer, getVerifiedUserId, toTripStatus } from './action-helpers';

const {
  tripRepository: tripRepo,
  organizationRepository: organizationRepo,
  destinationRepository: destRepo,
  tripFixedCostRepository: fixedCostRepo,
} = getContainer();

export type EditTripState = { error: string | null };

export async function editTripAction(
  tripId: string,
  _prev: EditTripState,
  formData: FormData,
): Promise<EditTripState> {
  const userResult = await getVerifiedUserId();
  if (!userResult.ok) return { error: userResult.error };
  const userId = userResult.value;

  const trip = await getAccessibleTrip(tripRepo, organizationRepo, tripId, userId);
  if (!trip) return { error: 'Trip not found' };

  const name = formData.get('name');
  const totalBudgetPounds = formData.get('totalBudgetPounds');
  const statusRaw = formData.get('status');

  if (
    typeof name !== 'string' ||
    typeof totalBudgetPounds !== 'string' ||
    typeof statusRaw !== 'string'
  ) {
    return { error: 'Invalid form data' };
  }
  if (!name.trim()) return { error: 'Trip name is required' };

  const totalBudgetPence = Math.round(Number.parseFloat(totalBudgetPounds) * 100);
  if (Number.isNaN(totalBudgetPence) || totalBudgetPence <= 0) {
    return { error: 'Invalid budget value' };
  }

  const status = toTripStatus(statusRaw);
  if (!status) return { error: 'Invalid status' };

  const result = await editTrip(tripRepo, destRepo, fixedCostRepo, {
    tripId,
    name: name.trim(),
    totalBudgetPence,
    currency: 'GBP', // GBP-only: see ADR 011
    status,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/');
  return { error: null };
}

export type DeleteTripState = { error: string | null };

export async function deleteTripAction(
  tripId: string,
  _prev: DeleteTripState,
  _formData: FormData,
): Promise<DeleteTripState> {
  const userResult = await getVerifiedUserId();
  if (!userResult.ok) return { error: userResult.error };
  const userId = userResult.value;

  const result = await deleteTrip(tripRepo, organizationRepo, {
    actorUserId: userId,
    tripId,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath('/');
  redirect('/');
}

export type MoveTripState = { error: string | null };

export async function moveTripToOrganizationAction(
  tripId: string,
  _prev: MoveTripState,
  formData: FormData,
): Promise<MoveTripState> {
  const userResult = await getVerifiedUserId();
  if (!userResult.ok) return { error: userResult.error };
  const userId = userResult.value;
  const targetOrganizationId = formData.get('targetOrganizationId');
  if (typeof targetOrganizationId !== 'string') return { error: 'Invalid form data' };

  const result = await moveTripToOrganization(tripRepo, organizationRepo, {
    actorUserId: userId,
    tripId,
    targetOrganizationId,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath(`/trips/${tripId}`);
  revalidatePath('/');
  return { error: null };
}
