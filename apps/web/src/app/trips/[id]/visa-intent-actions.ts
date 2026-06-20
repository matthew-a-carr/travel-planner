'use server';

import { revalidatePath } from 'next/cache';
import { setTripIntent } from '@/application/use-cases/set-trip-intent';
import { getAppContainer } from '@/infrastructure/container';
import { getAuthenticatedAccessContext } from '@/infrastructure/organization/active-organization';

export type TripIntentState = { readonly error: string | null };

export async function setTripIntentAction(
  _prev: TripIntentState,
  formData: FormData,
): Promise<TripIntentState> {
  const context = await getAuthenticatedAccessContext();
  if (!context) return { error: 'You must be signed in.' };

  const tripId = formData.get('tripId');
  const intent = formData.get('intent');
  if (typeof tripId !== 'string' || typeof intent !== 'string') {
    return { error: 'Invalid form data.' };
  }

  const { tripRepository, organizationRepository } = getAppContainer();
  const trip = await tripRepository.findById(tripId);
  if (!trip) return { error: 'Trip not found.' };

  // Authorise like the trip page: the user must belong to the trip's org.
  const membership = await organizationRepository.findMembership(
    trip.organizationId,
    context.userId,
  );
  if (!membership) return { error: 'You do not have access to this trip.' };

  const result = await setTripIntent(tripRepository, { tripId, intent });
  if (!result.ok) return { error: result.error };

  console.info('trip intent updated', { tripId, intent: result.value });
  revalidatePath(`/trips/${tripId}`);
  return { error: null };
}
