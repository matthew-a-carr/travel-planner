'use server';

import { revalidatePath } from 'next/cache';
import { addDestination } from '@/application/use-cases/add-destination';
import { editDestination } from '@/application/use-cases/edit-destination';
import { removeDestination } from '@/application/use-cases/remove-destination';
import type { Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';
import {
  getAccessibleTrip,
  getContainer,
  getVerifiedUserId,
  parseDateField,
  toComfortLevel,
} from './action-helpers';

const {
  tripRepository: tripRepo,
  organizationRepository: organizationRepo,
  destinationRepository: destRepo,
  tripFixedCostRepository: fixedCostRepo,
  countryReferenceRepository: countryRefRepo,
} = getContainer();

export type AddDestinationState = { error: string | null };

export async function addDestinationAction(
  tripId: string,
  _prev: AddDestinationState,
  formData: FormData,
): Promise<AddDestinationState> {
  const userResult = await getVerifiedUserId();
  if (!userResult.ok) return { error: userResult.error };

  const trip = await getAccessibleTrip(tripRepo, organizationRepo, tripId, userResult.value);
  if (!trip) return { error: 'Trip not found' };

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

  const countryRef = await countryRefRepo.findByCountry(country.trim());
  if (!countryRef) return { error: 'Please select a valid country from the list' };

  const estimatedBudgetPence = Math.round(Number.parseFloat(estimatedBudgetPounds) * 100);
  if (Number.isNaN(estimatedBudgetPence) || estimatedBudgetPence <= 0) {
    return { error: 'Invalid budget amount' };
  }

  const level = toComfortLevel(comfortLevel);
  if (!level) return { error: 'Invalid comfort level' };

  const startDate = parseDateField(formData.get('startDate'));
  const endDate = parseDateField(formData.get('endDate'));

  const cityRaw = formData.get('city');
  const latitudeRaw = formData.get('latitude');
  const longitudeRaw = formData.get('longitude');
  const city = typeof cityRaw === 'string' && cityRaw.trim() ? cityRaw.trim() : null;
  const latitude =
    typeof latitudeRaw === 'string' && latitudeRaw ? Number.parseFloat(latitudeRaw) : null;
  const longitude =
    typeof longitudeRaw === 'string' && longitudeRaw ? Number.parseFloat(longitudeRaw) : null;

  const result = await addDestination(tripRepo, destRepo, fixedCostRepo, {
    tripId,
    name: name.trim(),
    country: country.trim(),
    city,
    latitude: latitude !== null && !Number.isNaN(latitude) ? latitude : null,
    longitude: longitude !== null && !Number.isNaN(longitude) ? longitude : null,
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
  const userResult = await getVerifiedUserId();
  if (!userResult.ok) return { error: userResult.error };

  const trip = await getAccessibleTrip(tripRepo, organizationRepo, tripId, userResult.value);
  if (!trip) return { error: 'Trip not found' };

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

  const countryRef = await countryRefRepo.findByCountry(country.trim());
  if (!countryRef) return { error: 'Please select a valid country from the list' };

  const estimatedBudgetPence = Math.round(Number.parseFloat(estimatedBudgetPounds) * 100);
  if (Number.isNaN(estimatedBudgetPence) || estimatedBudgetPence <= 0) {
    return { error: 'Invalid budget amount' };
  }

  const level = toComfortLevel(comfortLevel);
  if (!level) return { error: 'Invalid comfort level' };

  const startDate = parseDateField(formData.get('startDate'));
  const endDate = parseDateField(formData.get('endDate'));

  const cityRaw = formData.get('city');
  const latitudeRaw = formData.get('latitude');
  const longitudeRaw = formData.get('longitude');
  const city = typeof cityRaw === 'string' && cityRaw.trim() ? cityRaw.trim() : null;
  const latitude =
    typeof latitudeRaw === 'string' && latitudeRaw ? Number.parseFloat(latitudeRaw) : null;
  const longitude =
    typeof longitudeRaw === 'string' && longitudeRaw ? Number.parseFloat(longitudeRaw) : null;

  const result = await editDestination(tripRepo, destRepo, fixedCostRepo, {
    destinationId,
    tripId,
    name: name.trim(),
    country: country.trim(),
    city,
    latitude: latitude !== null && !Number.isNaN(latitude) ? latitude : null,
    longitude: longitude !== null && !Number.isNaN(longitude) ? longitude : null,
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
): Promise<Result<void>> {
  const userResult = await getVerifiedUserId();
  if (!userResult.ok) return userResult;

  const trip = await getAccessibleTrip(tripRepo, organizationRepo, tripId, userResult.value);
  if (!trip) return err('Forbidden');

  await removeDestination(destRepo, destinationId);

  revalidatePath(`/trips/${tripId}`);
  return ok(undefined);
}
