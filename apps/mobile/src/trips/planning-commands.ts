import {
  type CreateDestinationRequest,
  type CreateFixedCostRequest,
  type TripDestination,
  type TripFixedCost,
  tripDestinationSchema,
  tripFixedCostSchema,
  type UpdateDestinationRequest,
  type UpdateFixedCostRequest,
} from '@travel-planner/shared';
import * as Crypto from 'expo-crypto';
import type { ZodType } from 'zod';
import { apiDelete, apiPatch, apiPost } from '../api/client';
import { getAccessToken } from '../auth/get-access-token';
import type { TripCommandResult } from './trip-commands';

async function token(): Promise<TripCommandResult<string>> {
  const access = await getAccessToken();
  return access.ok
    ? { ok: true, data: access.token }
    : { ok: false, message: 'Your session has expired. Please sign in again.' };
}

async function write<T>(
  method: 'POST' | 'PATCH',
  path: string,
  input: unknown,
  schema: ZodType<T>,
  fallback: string,
): Promise<TripCommandResult<T>> {
  const access = await token();
  if (!access.ok) return access;
  const result =
    method === 'POST'
      ? await apiPost(path, input, schema, access.data, Crypto.randomUUID())
      : await apiPatch(path, input, schema, access.data, Crypto.randomUUID());
  return result.ok
    ? { ok: true, data: result.data }
    : { ok: false, message: result.error.detail || fallback };
}

async function remove(path: string, fallback: string): Promise<TripCommandResult<undefined>> {
  const access = await token();
  if (!access.ok) return access;
  const result = await apiDelete(path, access.data, Crypto.randomUUID());
  return result.ok
    ? { ok: true, data: undefined }
    : { ok: false, message: result.error.detail || fallback };
}

const segment = encodeURIComponent;

export const createMobileDestination = (tripId: string, input: CreateDestinationRequest) =>
  write<TripDestination>(
    'POST',
    `/api/v1/trips/${segment(tripId)}/destinations`,
    input,
    tripDestinationSchema,
    'Could not add the destination.',
  );
export const updateMobileDestination = (
  tripId: string,
  destinationId: string,
  input: UpdateDestinationRequest,
) =>
  write<TripDestination>(
    'PATCH',
    `/api/v1/trips/${segment(tripId)}/destinations/${segment(destinationId)}`,
    input,
    tripDestinationSchema,
    'Could not update the destination.',
  );
export const deleteMobileDestination = (tripId: string, destinationId: string) =>
  remove(
    `/api/v1/trips/${segment(tripId)}/destinations/${segment(destinationId)}`,
    'Could not delete the destination.',
  );
export const createMobileFixedCost = (tripId: string, input: CreateFixedCostRequest) =>
  write<TripFixedCost>(
    'POST',
    `/api/v1/trips/${segment(tripId)}/fixed-costs`,
    input,
    tripFixedCostSchema,
    'Could not add the fixed cost.',
  );
export const updateMobileFixedCost = (
  tripId: string,
  fixedCostId: string,
  input: UpdateFixedCostRequest,
) =>
  write<TripFixedCost>(
    'PATCH',
    `/api/v1/trips/${segment(tripId)}/fixed-costs/${segment(fixedCostId)}`,
    input,
    tripFixedCostSchema,
    'Could not update the fixed cost.',
  );
export const deleteMobileFixedCost = (tripId: string, fixedCostId: string) =>
  remove(
    `/api/v1/trips/${segment(tripId)}/fixed-costs/${segment(fixedCostId)}`,
    'Could not delete the fixed cost.',
  );
