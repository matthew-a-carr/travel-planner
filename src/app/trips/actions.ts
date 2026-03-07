'use server';

import { redirect } from 'next/navigation';
import { createTrip } from '@/application/use-cases/create-trip';
import type { Currency } from '@/domain/trip/types';
import { getAppContainer } from '@/infrastructure/container';
import { getAuthenticatedAccessContext } from '@/infrastructure/organization/active-organization';

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
  const trip = await createTrip(tripRepository, {
    organizationId: context.activeOrganization.organization.id,
    ownerId: context.userId,
    name: name.trim(),
    totalBudgetPence,
    currency: 'GBP' as Currency, // GBP-only: see ADR 011
  });

  redirect(`/trips/${trip.id}`);
}
