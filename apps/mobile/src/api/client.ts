/**
 * Thin `fetch` wrapper for `/api/v1/*` calls from the mobile app.
 *
 * Reshaped in SPEC-008 for the standardised response envelope: every
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

/**
 * Hard ceiling on any single request. React Native's `fetch` has NO default
 * timeout, so a backend the device can't complete a connection to hangs the
 * caller indefinitely (observed as a 60–75s Maestro stall in the SPEC-014 e2e
 * journey). An AbortController bounds it so a stuck request surfaces as a fast
 * `internal` error instead of an opaque hang.
 */
const REQUEST_TIMEOUT_MS = 15000;

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: ApiError };
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

/**
 * `responseSchema` is optional. When omitted, the wrapper still
 * resolves to `{ ok: true; data: undefined }` on 2xx — callers
 * for endpoints that don't return a useful body (e.g. 204
 * No Content from POST /api/v1/auth/mobile/revoke) can skip the
 * schema entirely. When supplied, the body is parsed and any
 * shape drift throws loud.
 */
export async function apiPost<T = undefined>(
  path: string,
  body: unknown,
  responseSchema?: ZodType<T>,
  bearer?: string,
): Promise<ApiResult<T>> {
  return request(path, responseSchema, {
    method: 'POST',
    body: JSON.stringify(body),
    bearer,
  });
}

export async function apiGet<T = undefined>(
  path: string,
  responseSchema?: ZodType<T>,
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
  responseSchema: ZodType<T> | undefined,
  { method, body, bearer }: RequestOptions,
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (bearer !== undefined) headers.Authorization = `Bearer ${bearer}`;

  let response: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body,
      signal: controller.signal,
    });
  } catch {
    return { ok: false, error: synthesiseError('internal', 'Could not reach the server.', path) };
  } finally {
    clearTimeout(timer);
  }

  // 204 No Content — no body to parse. Skip the json() call entirely
  // (empty bodies fail JSON.parse, which would otherwise collapse to a
  // synthetic 'internal' error via the catch below). Used by /revoke
  // (sign-out) and any future delete-style endpoint.
  if (response.status === 204) {
    return { ok: true, data: undefined as T };
  }

  let payload: unknown;
  try {
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

  // No schema → no useful body to unwrap (e.g. a non-204 2xx from a
  // delete-style endpoint). Skip envelope parsing entirely.
  if (responseSchema === undefined) {
    return { ok: true, data: undefined as T };
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
