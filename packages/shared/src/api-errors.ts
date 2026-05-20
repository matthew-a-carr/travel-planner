import { z } from 'zod';

/**
 * Closed vocabulary of error codes returned in the `/api/v1/*` error
 * envelope, per ADR 050. The canonical list lives here; status-code
 * mapping (server-side concern) and `respondWithError` (server-side
 * helper) live in `apps/web/src/app/api/v1/_lib/errors.ts`.
 *
 * Adding a new code: edit this enum, add the matching `STATUS_BY_CODE`
 * entry on the web side, and document the code in
 * `apps/web/docs/api-conventions.md` (or `docs/api-conventions.md` —
 * keep both in lock-step per the doc-review table).
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

/**
 * Error envelope shape for `/api/v1/*` responses, per ADR 050.
 */
export const apiErrorBodySchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
