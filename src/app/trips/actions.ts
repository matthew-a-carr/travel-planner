'use server';

import { redirect } from 'next/navigation';
import { createTrip } from '@/application/use-cases/create-trip';
import type { Currency } from '@/domain/trip/types';
import { db } from '@/infrastructure/db/client';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';
import { getActiveOrganizationContext } from '@/infrastructure/organization/active-organization';

export type CreateTripState = { error: string | null };

export async function createTripAction(
  _prev: CreateTripState,
  formData: FormData,
): Promise<CreateTripState> {
  const context = await getActiveOrganizationContext();
  if (!context) return { error: 'Unauthorized' };

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

  const repo = new DrizzleTripRepository(db);
  const trip = await createTrip(repo, {
    organizationId: context.activeOrganization.organization.id,
    ownerId: context.userId,
    name: name.trim(),
    totalBudgetPence,
    currency: 'GBP' as Currency, // GBP-only: see ADR 011
  });

  redirect(`/trips/${trip.id}`);
}
