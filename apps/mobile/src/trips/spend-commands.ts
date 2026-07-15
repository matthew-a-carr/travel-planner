import {
  type CreateSpendRequest,
  spendEntrySchema,
  type UpdateSpendRequest,
  type WireSpendEntry,
} from '@travel-planner/shared';
import * as Crypto from 'expo-crypto';
import { apiDelete, apiPatch, apiPost } from '../api/client';
import { getAccessToken } from '../auth/get-access-token';
import type { TripCommandResult } from './trip-commands';

async function token(): Promise<TripCommandResult<string>> {
  const access = await getAccessToken();
  return access.ok
    ? { ok: true, data: access.token }
    : { ok: false, message: 'Your session has expired. Please sign in again.' };
}

const segment = encodeURIComponent;

export async function createMobileSpend(
  tripId: string,
  input: CreateSpendRequest,
): Promise<TripCommandResult<WireSpendEntry>> {
  const access = await token();
  if (!access.ok) return access;
  const result = await apiPost(
    `/api/v1/trips/${segment(tripId)}/spend`,
    input,
    spendEntrySchema,
    access.data,
    Crypto.randomUUID(),
  );
  return result.ok
    ? { ok: true, data: result.data }
    : { ok: false, message: result.error.detail || 'Could not record spend.' };
}

export async function updateMobileSpend(
  tripId: string,
  entryId: string,
  input: UpdateSpendRequest,
): Promise<TripCommandResult<WireSpendEntry>> {
  const access = await token();
  if (!access.ok) return access;
  const result = await apiPatch(
    `/api/v1/trips/${segment(tripId)}/spend/${segment(entryId)}`,
    input,
    spendEntrySchema,
    access.data,
    Crypto.randomUUID(),
  );
  return result.ok
    ? { ok: true, data: result.data }
    : { ok: false, message: result.error.detail || 'Could not update spend.' };
}

export async function deleteMobileSpend(
  tripId: string,
  entryId: string,
): Promise<TripCommandResult<undefined>> {
  const access = await token();
  if (!access.ok) return access;
  const result = await apiDelete(
    `/api/v1/trips/${segment(tripId)}/spend/${segment(entryId)}`,
    access.data,
    Crypto.randomUUID(),
  );
  return result.ok
    ? { ok: true, data: undefined }
    : { ok: false, message: result.error.detail || 'Could not delete spend.' };
}
