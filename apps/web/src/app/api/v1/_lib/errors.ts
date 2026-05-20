/**
 * Server-side error envelope helper for /api/v1/* responses.
 *
 * The error code vocabulary, envelope shape, and the runtime zod schema
 * live in `@travel-planner/shared` so the mobile client can parse error
 * responses against the same definitions. Status-code mapping and the
 * `respondWithError` helper stay here — they're server-side concerns.
 *
 * See ADR 050 and `docs/api-conventions.md`.
 */

import type { ApiErrorBody, ApiErrorCode } from '@travel-planner/shared';

export type { ApiErrorBody, ApiErrorCode } from '@travel-planner/shared';

const STATUS_BY_CODE: Readonly<Record<ApiErrorCode, number>> = {
  validation_failed: 400,
  bad_request: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  user_deleted: 410,
  gone: 410,
  rate_limited: 429,
  internal: 500,
  unavailable: 503,
  invalid_exchange_code: 400,
  pkce_mismatch: 400,
  refresh_reused: 401,
  refresh_expired: 401,
  refresh_revoked: 401,
  refresh_unknown: 401,
};

export function respondWithError(
  code: ApiErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): Response {
  const body: ApiErrorBody =
    details === undefined ? { error: { code, message } } : { error: { code, message, details } };

  return Response.json(body, {
    status: STATUS_BY_CODE[code],
    headers: { 'Cache-Control': 'no-store' },
  });
}
