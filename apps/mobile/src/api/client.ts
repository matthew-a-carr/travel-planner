/**
 * Thin `fetch` wrapper for `/api/v1/*` calls from the mobile app.
 *
 * Reshaped in SPEC-007 for the standardised response envelope: every
 * 2xx body is `{ data: <T>, request, asof, version, meta? }`; every
 * non-2xx body is RFC 7807 + closed `code` (`{ error: { type, title,
 * status, detail, instance, code, details? }, request, asof,
 * version }`).
 *
 * Both shapes are runtime-validated against `@travel-planner/shared`.
 * On wire-shape drift the underlying `.parse(...)` throws so the bug
 * surfaces loud rather than silently corrupting downstream state.
 *
 * If a 4xx/5xx response carries a malformed body that doesn't match
 * the error envelope, the client falls back to a synthetic
 * `code: 'internal'` failure so the orchestrator can render generic-
 * error UX instead of crashing. Network failures (fetch rejects or
 * res.json() chokes on a non-JSON body) collapse to the same.
 *
 * Callers dispatch on `error.code` (the closed enum) regardless of
 * whether the failure came from the server or from a fallback.
 *
 * `EXPO_PUBLIC_API_BASE_URL` is the build-time env var pointing at
 * the server (defaults to `http://localhost:3000` for Simulator dev).
 */

import type { ApiError, ApiErrorCode } from '@travel-planner/shared';
import { apiErrorEnvelopeSchema, apiSuccessSchema } from '@travel-planner/shared';
import type { ZodType } from 'zod';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: ApiError };
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export async function apiPost<T>(
  path: string,
  body: unknown,
  responseSchema: ZodType<T>,
  bearer?: string,
): Promise<ApiResult<T>> {
  return request(path, responseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
    bearer,
  });
}

export async function apiGet<T>(
  path: string,
  responseSchema: ZodType<T>,
  bearer?: string,
): Promise<ApiResult<T>> {
  return request(path, responseSchema, {
    method: 'GET',
    bearer,
  });
}

type RequestOptions = {
  method: 'GET' | 'POST';
  body?: string;
  bearer?: string;
};

async function request<T>(
  path: string,
  responseSchema: ZodType<T>,
  { method, body, bearer }: RequestOptions,
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (bearer !== undefined) headers.Authorization = `Bearer ${bearer}`;

  let response: Response;
  let payload: unknown;
  try {
    response = await fetch(`${BASE_URL}${path}`, { method, headers, body });
    payload = await response.json();
  } catch {
    return { ok: false, error: synthesiseError('internal', 'Could not reach the server.', path) };
  }

  if (!response.ok) {
    const parsed = apiErrorEnvelopeSchema.safeParse(payload);
    if (parsed.success) {
      return { ok: false, error: parsed.data.error };
    }
    return { ok: false, error: synthesiseError('internal', 'Unexpected error.', path) };
  }

  const envelopeSchema = apiSuccessSchema(responseSchema);
  // .parse() throws on success-body wire-shape drift — intentional.
  const successEnvelope = envelopeSchema.parse(payload);
  return { ok: true, data: successEnvelope.data };
}

/**
 * Build a synthetic ApiError when the failure originated client-side
 * (network down, malformed body) so the type contract is uniform.
 * Status is a placeholder (500) — semantically there isn't a real
 * HTTP status when the server never replied, but the envelope schema
 * requires one.
 */
function synthesiseError(code: ApiErrorCode, detail: string, path: string): ApiError {
  return {
    type: `https://travel-planner.app/errors/${code}`,
    title: 'Internal server error',
    status: 500,
    detail,
    instance: path,
    code,
  };
}
