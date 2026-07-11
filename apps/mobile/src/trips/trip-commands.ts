import {
  type CreateTripRequest,
  type TripSummary,
  tripSummarySchema,
  type UpdateTripRequest,
} from '@travel-planner/shared';
import * as Crypto from 'expo-crypto';
import { apiDelete, apiPatch, apiPost } from '../api/client';
import { getAccessToken } from '../auth/get-access-token';

export type TripCommandResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly message: string };

async function accessToken(): Promise<TripCommandResult<string>> {
  const access = await getAccessToken();
  if (!access.ok) {
    return { ok: false, message: 'Your session has expired. Please sign in again.' };
  }
  return { ok: true, data: access.token };
}

export async function createMobileTrip(
  input: CreateTripRequest,
): Promise<TripCommandResult<TripSummary>> {
  const access = await accessToken();
  if (!access.ok) return access;
  const result = await apiPost(
    '/api/v1/trips',
    input,
    tripSummarySchema,
    access.data,
    Crypto.randomUUID(),
  );
  return result.ok
    ? { ok: true, data: result.data }
    : { ok: false, message: result.error.detail || 'Could not create the trip.' };
}

export async function updateMobileTrip(
  tripId: string,
  input: UpdateTripRequest,
): Promise<TripCommandResult<TripSummary>> {
  const access = await accessToken();
  if (!access.ok) return access;
  const result = await apiPatch(
    `/api/v1/trips/${encodeURIComponent(tripId)}`,
    input,
    tripSummarySchema,
    access.data,
    Crypto.randomUUID(),
  );
  return result.ok
    ? { ok: true, data: result.data }
    : { ok: false, message: result.error.detail || 'Could not update the trip.' };
}

export async function deleteMobileTrip(tripId: string): Promise<TripCommandResult<undefined>> {
  const access = await accessToken();
  if (!access.ok) return access;
  const result = await apiDelete(
    `/api/v1/trips/${encodeURIComponent(tripId)}`,
    access.data,
    Crypto.randomUUID(),
  );
  return result.ok
    ? { ok: true, data: undefined }
    : { ok: false, message: result.error.detail || 'Could not delete the trip.' };
}
