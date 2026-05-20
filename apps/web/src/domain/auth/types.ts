/**
 * Domain types for mobile auth (SPEC-004 / ADR 051).
 *
 * Pure types only — no infrastructure leakage. Repository implementations
 * map between DB rows and these records.
 */

import type { Result } from '../trip/types';

/**
 * Persistence-shaped view of a refresh token. The cleartext value is
 * never represented in the domain — only its sha256 hash, per ADR 051 §2.
 */
export type RefreshTokenRecord = {
  readonly id: string;
  readonly userId: string;
  readonly tokenHash: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly replacedById: string | null;
  readonly revokedAt: Date | null;
};

/**
 * Outcome of attempting to use a refresh token. The use case loads the
 * presented row (and, if `replacedById` is populated, the rest of the
 * chain) and passes them to `decideRotation`. The domain returns one of
 * five tagged outcomes.
 */
export type RotationDecision =
  | { readonly kind: 'rotate'; readonly presentedId: string }
  | { readonly kind: 'unknown_token' }
  | { readonly kind: 'expired' }
  | { readonly kind: 'revoked' }
  | { readonly kind: 'reused'; readonly chainIdsToRevoke: readonly string[] };

/**
 * Result of comparing a fresh `code_verifier`-derived challenge against
 * the challenge stored at `/auth/mobile/start` time.
 *
 * The actual SHA-256 hashing happens in the application layer (uses Web
 * Crypto's async `subtle.digest`); the domain just performs a
 * constant-time string compare between two base64url-encoded challenges.
 */
export type PkceMatchResult = Result<true, 'pkce_mismatch'>;
