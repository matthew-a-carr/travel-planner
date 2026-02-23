'use server';

import { redirect } from 'next/navigation';
import { createTrip } from '@/application/use-cases/create-trip';
import type { Currency } from '@/domain/trip/types';
import { auth } from '@/infrastructure/auth';
import { db } from '@/infrastructure/db/client';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';

export async function createTripAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error('Unauthorized');

  const name = formData.get('name');
  const totalBudgetPounds = formData.get('totalBudgetPounds');

  if (typeof name !== 'string' || typeof totalBudgetPounds !== 'string') {
    throw new Error('Invalid form data');
  }

  const totalBudgetPence = Math.round(Number.parseFloat(totalBudgetPounds) * 100);
  if (Number.isNaN(totalBudgetPence) || totalBudgetPence <= 0) {
    throw new Error('Invalid budget value');
  }

  const repo = new DrizzleTripRepository(db);
  const trip = await createTrip(repo, {
    ownerId: session.user.id,
    name: name.trim(),
    totalBudgetPence,
    currency: 'GBP' as Currency,
  });

  redirect(`/trips/${trip.id}`);
}
