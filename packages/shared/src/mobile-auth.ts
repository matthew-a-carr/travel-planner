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

// ---------------------------------------------------------------------------
// POST /api/v1/auth/mobile/start
// ---------------------------------------------------------------------------

/**
 * Body sent by the mobile client to initiate the PKCE flow.
 * `code_challenge` is the SHA-256 hash of the verifier, base64url
 * encoded (43 chars without padding for SHA-256; we allow up to 128
 * to give future-proofing slack).
 */
export const mobileAuthStartRequestSchema = z.object({
  code_challenge: z.string().min(43).max(128),
});
export type MobileAuthStartRequest = z.infer<typeof mobileAuthStartRequestSchema>;

/**
 * Response: the URL the mobile client opens in the system browser and
 * the opaque `state` it should expect Google to echo back.
 */
export const mobileAuthStartResponseSchema = z.object({
  authorise_url: z.string().min(1),
  state: z.string().min(1),
});
export type MobileAuthStartResponse = z.infer<typeof mobileAuthStartResponseSchema>;

// ---------------------------------------------------------------------------
// POST /api/v1/auth/mobile/exchange
// ---------------------------------------------------------------------------

/**
 * Body sent by the mobile client after it captures the one-time
 * `?code=<...>` from the deep-link redirect. `code_verifier` is the
 * pre-image of the `code_challenge` sent in /start (base64url, 43
 * chars for SHA-256 + standard PKCE upper bound of 128).
 */
export const mobileAuthExchangeRequestSchema = z.object({
  code: z.string().min(1),
  code_verifier: z.string().min(43).max(128),
});
export type MobileAuthExchangeRequest = z.infer<typeof mobileAuthExchangeRequestSchema>;

/**
 * Response: the short-lived JWT access token, the opaque rotating
 * refresh token, and an absolute ISO 8601 UTC timestamp at which the
 * access token expires. Mobile clients parse the timestamp via
 * `new Date(...)` and use it to decide when to refresh.
 *
 * `access_expires_at` is intentionally a string on the wire — JSON
 * doesn't survive a Date round-trip without an explicit revival step.
 */
export const mobileAuthExchangeResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  access_expires_at: z.string().min(1),
});
export type MobileAuthExchangeResponse = z.infer<typeof mobileAuthExchangeResponseSchema>;

// ---------------------------------------------------------------------------
// POST /api/v1/auth/mobile/refresh
// ---------------------------------------------------------------------------

/** Body: the current refresh token. */
export const mobileAuthRefreshRequestSchema = z.object({
  refresh_token: z.string().min(1),
});
export type MobileAuthRefreshRequest = z.infer<typeof mobileAuthRefreshRequestSchema>;

/**
 * Response: identical shape to /exchange — a new access + refresh
 * pair and the new access token's absolute expiry timestamp.
 */
export const mobileAuthRefreshResponseSchema = mobileAuthExchangeResponseSchema;
export type MobileAuthRefreshResponse = z.infer<typeof mobileAuthRefreshResponseSchema>;

// ---------------------------------------------------------------------------
// POST /api/v1/auth/mobile/revoke
// ---------------------------------------------------------------------------

/**
 * Body sent by the mobile client to revoke a refresh-token chain
 * (sign-out). Server marks the presented (active head) row as
 * `revoked_at = now`; subsequent /refresh calls with that token
 * return `refresh_revoked`. Predecessor rows in the chain are not
 * touched here — any attempt to reuse them fires reuse-detection
 * in /refresh and revokes the rest of the chain (ADR 054).
 *
 * Response is 204 No Content on success. The operation is
 * idempotent — calling twice with the same token is also 204. The
 * server intentionally returns 204 for unknown / malformed tokens
 * too, since the endpoint promises "if you had a token, it's
 * revoked now" rather than confirming token existence.
 */
export const mobileAuthRevokeRequestSchema = z.object({
  refresh_token: z.string().min(1),
});
export type MobileAuthRevokeRequest = z.infer<typeof mobileAuthRevokeRequestSchema>;
