import { z } from 'zod';

/**
 * Closed set of `?error=<reason>` deep-link values returned by
 * `GET /api/v1/auth/mobile/callback` when the OAuth flow can't produce
 * a one-time exchange code. Mobile clients exhaustively switch on
 * this set.
 *
 * Adding a new reason: edit this enum AND add the emit site in
 * `apps/web/src/app/api/v1/auth/mobile/callback/route.ts` or
 * `apps/web/src/application/use-cases/auth/mobile/handle-mobile-callback.ts`.
 * Both files type their reason parameter to `MobileAuthCallbackError`,
 * so any mismatch is a compile error.
 */
export const mobileAuthCallbackErrorSchema = z.enum([
  'invalid_request',
  'server_error',
  'invalid_state',
  'google_error',
  'access_denied',
]);
export type MobileAuthCallbackError = z.infer<typeof mobileAuthCallbackErrorSchema>;
