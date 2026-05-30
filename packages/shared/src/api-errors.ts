import { z } from 'zod';

/**
 * Closed vocabulary of error codes returned in the `/api/v1/*` error
 * envelope, per ADR 050 (superseded by ADR 056). The canonical list
 * lives here; the surrounding RFC 7807 + envelope schema is in
 * `envelope.ts`; status-code mapping (server-side concern), RFC 7807
 * `type` URI mapping, default titles, and `respondWithError`
 * (server-side helper) live in
 * `apps/web/src/app/api/v1/_lib/errors.ts`.
 *
 * Adding a new code: edit this enum, add matching entries in
 * `STATUS_BY_CODE`, `TYPE_URI_BY_CODE`, and `DEFAULT_TITLE_BY_CODE` on
 * the web side, and document the code in `docs/api-conventions.md`.
 */
export const apiErrorCodeSchema = z.enum([
  'validation_failed',
  'bad_request',
  'unauthenticated',
  'forbidden',
  'not_found',
  'conflict',
  'user_deleted',
  'gone',
  'rate_limited',
  'internal',
  'unavailable',
  // Mobile auth (SPEC-004 / ADR 051)
  'invalid_exchange_code',
  'pkce_mismatch',
  'refresh_reused',
  'refresh_expired',
  'refresh_revoked',
  'refresh_unknown',
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
