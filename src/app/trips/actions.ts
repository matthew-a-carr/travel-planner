'use server';

import { redirect } from 'next/navigation';
import { createTrip } from '@/application/use-cases/create-trip';
import type { Currency } from '@/domain/trip/types';
import { auth } from '@/infrastructure/auth';
import { db } from '@/infrastructure/db/client';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';

export async function createTripAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const name = formData.get('name');
  const totalBudgetPounds = formData.get('totalBudgetPounds');
  const ringfencedPounds = formData.get('ringfencedPounds');
  const ringfencedLabel = formData.get('ringfencedLabel');

  if (
    typeof name !== 'string' ||
    typeof totalBudgetPounds !== 'string' ||
    typeof ringfencedPounds !== 'string'
  ) {
    throw new Error('Invalid form data');
  }

  const totalBudgetPence = Math.round(parseFloat(totalBudgetPounds) * 100);
  const ringfencedAmountPence = Math.round(parseFloat(ringfencedPounds) * 100);

  if (
    Number.isNaN(totalBudgetPence) ||
    Number.isNaN(ringfencedAmountPence) ||
    totalBudgetPence <= 0
  ) {
    throw new Error('Invalid budget values');
  }

  const repo = new DrizzleTripRepository(db);

  const trip = await createTrip(repo, {
    ownerId: session.user.id,
    name: name.trim(),
    totalBudgetPence,
    currency: 'GBP' as Currency,
    ringfencedAmountPence,
    ringfencedLabel:
      typeof ringfencedLabel === 'string' && ringfencedLabel.trim() ? ringfencedLabel.trim() : null,
  });

  redirect(`/trips/${trip.id}`);
}
