/**
 * Error envelope for /api/v1/* responses. The shape, codes, and status
 * mapping are codified in docs/api-conventions.md and ADR 050.
 */

export type ApiErrorCode =
  | 'validation_failed'
  | 'bad_request'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'user_deleted'
  | 'gone'
  | 'rate_limited'
  | 'internal'
  | 'unavailable'
  // Mobile auth (SPEC-004 / ADR 051)
  | 'invalid_exchange_code'
  | 'pkce_mismatch'
  | 'refresh_reused'
  | 'refresh_expired'
  | 'refresh_revoked'
  | 'refresh_unknown';

export type ApiErrorBody = {
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
  };
};

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
