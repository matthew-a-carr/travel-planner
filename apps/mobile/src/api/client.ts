import { type ApiErrorBody, apiErrorBodySchema } from '@travel-planner/shared';
import type { ZodType } from 'zod';

/**
 * Thin `fetch` wrapper for `/api/v1/*` calls from the mobile app.
 *
 * Validates response bodies against the shared `@travel-planner/shared`
 * schemas — same source of truth the web integration tests use. On
 * server-side wire drift (response body doesn't match the schema), the
 * underlying `responseSchema.parse(...)` throws so the bug surfaces
 * loud rather than silently corrupting downstream state.
 *
 * Error envelopes (`{ error: { code, message, details? } }`) are
 * parsed via `apiErrorBodySchema`. If a 4xx/5xx response carries a
 * malformed body that doesn't match the envelope, the client falls
 * back to `{ code: 'internal', message: 'Unexpected error.' }` rather
 * than throwing — that way the orchestrator can render generic-error
 * UX instead of crashing.
 *
 * Network failures (`fetch` rejects, or `res.json()` chokes on a
 * non-JSON body) are caught and surfaced as
 * `{ code: 'internal', message: 'Could not reach the server.' }`.
 *
 * `EXPO_PUBLIC_API_BASE_URL` is the build-time env var pointing at the
 * server (defaults to `http://localhost:3000` for Simulator dev).
 * `pnpm dev:mobile` workflows on a real device should export it as
 * the Mac's LAN IP (see `apps/mobile/AGENTS.md`).
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: ApiErrorBody['error'] };
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
    return networkFailure();
  }

  if (!response.ok) {
    const parsed = apiErrorBodySchema.safeParse(payload);
    if (parsed.success) {
      return { ok: false, error: parsed.data.error };
    }
    return malformedEnvelopeFallback();
  }

  return { ok: true, data: responseSchema.parse(payload) };
}

function networkFailure(): ApiFailure {
  return {
    ok: false,
    error: { code: 'internal', message: 'Could not reach the server.' },
  };
}

function malformedEnvelopeFallback(): ApiFailure {
  return {
    ok: false,
    error: { code: 'internal', message: 'Unexpected error.' },
  };
}
