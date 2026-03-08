'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addDestination } from '@/application/use-cases/add-destination';
import { addFixedCost } from '@/application/use-cases/add-fixed-cost';
import { deleteSpendEntry } from '@/application/use-cases/delete-spend-entry';
import { deleteTrip } from '@/application/use-cases/delete-trip';
import { editDestination } from '@/application/use-cases/edit-destination';
import { editFixedCost } from '@/application/use-cases/edit-fixed-cost';
import { editSpendEntry } from '@/application/use-cases/edit-spend-entry';
import { editTrip } from '@/application/use-cases/edit-trip';
import { moveTripToOrganization } from '@/application/use-cases/move-trip-to-organization';
import { recordSpend } from '@/application/use-cases/record-spend';
import { removeDestination } from '@/application/use-cases/remove-destination';
import { removeFixedCost } from '@/application/use-cases/remove-fixed-cost';
import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type {
  ComfortLevel,
  FixedCostCategory,
  SpendCategory,
  Trip,
  TripStatus,
} from '@/domain/trip/types';
import { getAppContainer } from '@/infrastructure/container';
import { getAuthenticatedAccessContext } from '@/infrastructure/organization/active-organization';

const {
  tripRepository: tripRepo,
  organizationRepository: organizationRepo,
  destinationRepository: destRepo,
  tripFixedCostRepository: fixedCostRepo,
  spendEntryRepository: spendRepo,
} = getAppContainer();

const TRIP_STATUSES: readonly TripStatus[] = ['planning', 'active', 'completed'];

function toTripStatus(v: string): TripStatus | null {
  return (TRIP_STATUSES as readonly string[]).includes(v) ? (v as TripStatus) : null;
}

const SPEND_CATEGORIES: readonly SpendCategory[] = [
  'accommodation',
  'food',
  'transport',
  'activities',
  'shopping',
  'other',
];

const COMFORT_LEVELS: readonly ComfortLevel[] = ['budget', 'mid', 'luxury'];

const FIXED_COST_CATEGORIES: readonly FixedCostCategory[] = [
  'accommodation',
  'bills',
  'fuel',
  'groceries',
  'insurance',
  'transport',
  'activities',
  'shopping',
  'other',
];

function toFixedCostCategory(v: string): FixedCostCategory | null {
  return (FIXED_COST_CATEGORIES as readonly string[]).includes(v) ? (v as FixedCostCategory) : null;
}

function toSpendCategory(v: string): SpendCategory | null {
  return (SPEND_CATEGORIES as readonly string[]).includes(v) ? (v as SpendCategory) : null;
}

function toComfortLevel(v: string): ComfortLevel | null {
  return (COMFORT_LEVELS as readonly string[]).includes(v) ? (v as ComfortLevel) : null;
}

async function getVerifiedUserId(): Promise<string> {
  const context = await getAuthenticatedAccessContext();
  if (!context?.userId) throw new Error('Unauthorized');
  if (!context.activeOrganization) throw new Error('No organization membership');
  return context.userId;
}

async function getAccessibleTrip(
  tripRepo: TripRepository,
  organizationRepo: OrganizationRepository,
  tripId: string,
  userId: string,
): Promise<Trip | null> {
  const trip = await tripRepo.findById(tripId);
  if (!trip) return null;

  const membership = await organizationRepo.findMembership(trip.organizationId, userId);
  if (!membership) return null;
  return trip;
}

/** Parses an optional ISO date string (YYYY-MM-DD) from a form field. Returns null if absent. */
function parseDateField(value: FormDataEntryValue | null): Date | null {
  if (!value || typeof value !== 'string' || value.trim() === '') return null;
  const d = new Date(value.trim());
  return Number.isNaN(d.getTime()) ? null : d;
}

// ─── Trip edit action ─────────────────────────────────────────────────────────

export type EditTripState = { error: string | null };

export async function editTripAction(
  tripId: string,
  _prev: EditTripState,
  formData: FormData,
): Promise<EditTripState> {
  const userId = await getVerifiedUserId();

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

// ─── Fixed cost actions ───────────────────────────────────────────────────────

export type FixedCostState = { error: string | null };

export async function addFixedCostAction(
  tripId: string,
  _prev: FixedCostState,
  formData: FormData,
): Promise<FixedCostState> {
  const userId = await getVerifiedUserId();

  const trip = await getAccessibleTrip(tripRepo, organizationRepo, tripId, userId);
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

export async function removeFixedCostAction(tripId: string, fixedCostId: string): Promise<void> {
  const userId = await getVerifiedUserId();

  const trip = await getAccessibleTrip(tripRepo, organizationRepo, tripId, userId);
  if (!trip) throw new Error('Forbidden');

  await removeFixedCost(fixedCostRepo, fixedCostId);

  revalidatePath(`/trips/${tripId}`);
}

export type EditFixedCostState = { error: string | null };

export async function editFixedCostAction(
  tripId: string,
  fixedCostId: string,
  _prev: EditFixedCostState,
  formData: FormData,
): Promise<EditFixedCostState> {
  const userId = await getVerifiedUserId();

  const trip = await getAccessibleTrip(tripRepo, organizationRepo, tripId, userId);
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

// ─── Destination actions ──────────────────────────────────────────────────────

export type AddDestinationState = { error: string | null };

export async function addDestinationAction(
  tripId: string,
  _prev: AddDestinationState,
  formData: FormData,
): Promise<AddDestinationState> {
  const userId = await getVerifiedUserId();

  const trip = await getAccessibleTrip(tripRepo, organizationRepo, tripId, userId);
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

  const estimatedBudgetPence = Math.round(Number.parseFloat(estimatedBudgetPounds) * 100);
  if (Number.isNaN(estimatedBudgetPence) || estimatedBudgetPence <= 0) {
    return { error: 'Invalid budget amount' };
  }

  const level = toComfortLevel(comfortLevel);
  if (!level) return { error: 'Invalid comfort level' };

  const startDate = parseDateField(formData.get('startDate'));
  const endDate = parseDateField(formData.get('endDate'));

  const result = await addDestination(tripRepo, destRepo, fixedCostRepo, {
    tripId,
    name: name.trim(),
    country: country.trim(),
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
  const userId = await getVerifiedUserId();

  const trip = await getAccessibleTrip(tripRepo, organizationRepo, tripId, userId);
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

  const estimatedBudgetPence = Math.round(Number.parseFloat(estimatedBudgetPounds) * 100);
  if (Number.isNaN(estimatedBudgetPence) || estimatedBudgetPence <= 0) {
    return { error: 'Invalid budget amount' };
  }

  const level = toComfortLevel(comfortLevel);
  if (!level) return { error: 'Invalid comfort level' };

  const startDate = parseDateField(formData.get('startDate'));
  const endDate = parseDateField(formData.get('endDate'));

  const result = await editDestination(tripRepo, destRepo, fixedCostRepo, {
    destinationId,
    tripId,
    name: name.trim(),
    country: country.trim(),
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
): Promise<void> {
  const userId = await getVerifiedUserId();

  const trip = await getAccessibleTrip(tripRepo, organizationRepo, tripId, userId);
  if (!trip) throw new Error('Forbidden');

  await removeDestination(destRepo, destinationId);

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

  const trip = await getAccessibleTrip(tripRepo, organizationRepo, tripId, userId);
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

// ─── Spend entry management actions ──────────────────────────────────────────

export async function deleteSpendEntryAction(tripId: string, entryId: string): Promise<void> {
  const userId = await getVerifiedUserId();

  const trip = await getAccessibleTrip(tripRepo, organizationRepo, tripId, userId);
  if (!trip) throw new Error('Forbidden');

  await deleteSpendEntry(spendRepo, entryId);

  revalidatePath(`/trips/${tripId}`);
}

export type EditSpendEntryState = { error: string | null };

export async function editSpendEntryAction(
  tripId: string,
  entryId: string,
  _prev: EditSpendEntryState,
  formData: FormData,
): Promise<EditSpendEntryState> {
  const userId = await getVerifiedUserId();

  const trip = await getAccessibleTrip(tripRepo, organizationRepo, tripId, userId);
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

export type MoveTripState = { error: string | null };

export type DeleteTripState = { error: string | null };

export async function deleteTripAction(
  tripId: string,
  _prev: DeleteTripState,
  _formData: FormData,
): Promise<DeleteTripState> {
  const userId = await getVerifiedUserId();

  const result = await deleteTrip(tripRepo, organizationRepo, {
    actorUserId: userId,
    tripId,
  });

  if (!result.ok) return { error: result.error };
  revalidatePath('/');
  redirect('/');
}

export async function moveTripToOrganizationAction(
  tripId: string,
  _prev: MoveTripState,
  formData: FormData,
): Promise<MoveTripState> {
  const userId = await getVerifiedUserId();
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
