/**
 * Server-side error envelope helper for `/api/v1/*` responses
 * (SPEC-008 / ADR 056).
 *
 * The error code vocabulary, envelope schema, and the runtime zod
 * schema live in `@travel-planner/shared` so the mobile client can
 * parse error responses against the same definitions. Status-code
 * mapping, RFC 7807 `type` URI mapping, default titles, and the
 * `respondWithError` helper are server-side concerns and stay here.
 */

import type { ApiError, ApiErrorCode, ApiErrorEnvelope } from '@travel-planner/shared';
import { ENVELOPE_VERSION } from '@travel-planner/shared';
import { buildRequestEcho } from './respond';

export type { ApiErrorCode } from '@travel-planner/shared';

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

const TYPE_URI_BASE = 'https://travel-planner.app/errors';

/**
 * One stable URI per error code. Pattern locked by ADR 056 §Decision
 * item 2; renaming a URI is a major-version envelope change.
 */
const TYPE_URI_BY_CODE: Readonly<Record<ApiErrorCode, string>> = Object.freeze({
  validation_failed: `${TYPE_URI_BASE}/validation_failed`,
  bad_request: `${TYPE_URI_BASE}/bad_request`,
  unauthenticated: `${TYPE_URI_BASE}/unauthenticated`,
  forbidden: `${TYPE_URI_BASE}/forbidden`,
  not_found: `${TYPE_URI_BASE}/not_found`,
  conflict: `${TYPE_URI_BASE}/conflict`,
  user_deleted: `${TYPE_URI_BASE}/user_deleted`,
  gone: `${TYPE_URI_BASE}/gone`,
  rate_limited: `${TYPE_URI_BASE}/rate_limited`,
  internal: `${TYPE_URI_BASE}/internal`,
  unavailable: `${TYPE_URI_BASE}/unavailable`,
  invalid_exchange_code: `${TYPE_URI_BASE}/invalid_exchange_code`,
  pkce_mismatch: `${TYPE_URI_BASE}/pkce_mismatch`,
  refresh_reused: `${TYPE_URI_BASE}/refresh_reused`,
  refresh_expired: `${TYPE_URI_BASE}/refresh_expired`,
  refresh_revoked: `${TYPE_URI_BASE}/refresh_revoked`,
  refresh_unknown: `${TYPE_URI_BASE}/refresh_unknown`,
});

/**
 * Default sentence-cased title per code (RFC 7807 §3.1.1 — "short
 * human-readable summary of the problem type"). Callers may override
 * with `opts.title`.
 */
const DEFAULT_TITLE_BY_CODE: Readonly<Record<ApiErrorCode, string>> = Object.freeze({
  validation_failed: 'Validation failed',
  bad_request: 'Bad request',
  unauthenticated: 'Authentication required',
  forbidden: 'Access denied',
  not_found: 'Not found',
  conflict: 'Conflict',
  user_deleted: 'Account deleted',
  gone: 'Resource gone',
  rate_limited: 'Rate limited',
  internal: 'Internal server error',
  unavailable: 'Service unavailable',
  invalid_exchange_code: 'Invalid exchange code',
  pkce_mismatch: 'PKCE verifier mismatch',
  refresh_reused: 'Refresh token reused',
  refresh_expired: 'Refresh token expired',
  refresh_revoked: 'Refresh token revoked',
  refresh_unknown: 'Refresh token unknown',
});

export type RespondWithErrorOpts = {
  readonly detail?: string;
  readonly title?: string;
  readonly details?: Record<string, unknown>;
  readonly pathParams?: Record<string, string>;
};

/**
 * Build an RFC 7807 + `code` error envelope. The HTTP status is looked
 * up from the closed `code` enum; `type` URI and `title` have stable
 * per-code defaults that callers can override.
 *
 * `detail` defaults to the title when the caller doesn't supply one
 * (e.g. internal-error catch-alls). `details` is per-code free-form
 * payload (`field_errors`, `retry_after_seconds`, …).
 */
export function respondWithError(
  request: Request,
  code: ApiErrorCode,
  opts: RespondWithErrorOpts = {},
): Response {
  const status = STATUS_BY_CODE[code];
  const url = new URL(request.url);
  const title = opts.title ?? DEFAULT_TITLE_BY_CODE[code];
  const detail = opts.detail ?? title;

  const error: ApiError = {
    type: TYPE_URI_BY_CODE[code],
    title,
    status,
    detail,
    instance: url.pathname,
    code,
    ...(opts.details !== undefined ? { details: opts.details } : {}),
  };

  const body: ApiErrorEnvelope = {
    error,
    request: buildRequestEcho(request, opts.pathParams ?? {}),
    asof: new Date().toISOString(),
    version: ENVELOPE_VERSION,
  };

  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
