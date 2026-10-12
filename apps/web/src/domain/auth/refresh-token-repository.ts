/**
 * Repository for the rotating refresh-token table (ADR 051 §2 / SPEC-004 §7).
 *
 * `rotate()` is the load-bearing operation: it must perform the lookup,
 * insert of the successor row, and update of `replaced_by_id` on the
 * predecessor inside a single transaction with `SELECT … FOR UPDATE` on
 * the presented row, so two concurrent refreshes can't both succeed.
 *
 * Reuse detection revokes the forward chain inside the rotation transaction.
 * `revokeChain()` provides the same forward locking and revocation for sign-out.
 * Both preserve existing revocation timestamps.
 */

import type { RefreshTokenRecord } from './types';

export type CreateRefreshTokenInput = {
  readonly userId: string;
  readonly tokenHash: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
};

export type RotateRefreshTokenInput = {
  /**
   * sha256 of the cleartext refresh token presented by the client.
   */
  readonly presentedTokenHash: string;
  /**
   * Pre-hashed successor token to insert (with the same userId as the
   * presented one).
   */
  readonly successor: CreateRefreshTokenInput;
};

export type RotateRefreshTokenOutcome =
  /**
   * The presented row existed and was not yet rotated, so the
   * successor was inserted, the predecessor was linked via
   * `replaced_by_id`, and the new row id is returned along with the
   * full new row.
   */
  | { readonly kind: 'rotated'; readonly successor: RefreshTokenRecord }
  /**
   * The presented row was already rotated (`replaced_by_id` set) by a
   * prior call. The full forward chain has been locked and revoked in
   * the same transaction. Return it for the reuse-detection observer.
   */
  | { readonly kind: 'reused'; readonly chain: readonly RefreshTokenRecord[] }
  /**
   * The presented row was found but is unusable (expired or revoked).
   * Reuse-detection does not fire for this branch.
   */
  | { readonly kind: 'unusable'; readonly reason: 'expired' | 'revoked' }
  /**
   * No row with the presented hash exists.
   */
  | { readonly kind: 'unknown' };

export interface RefreshTokenRepository {
  create(input: CreateRefreshTokenInput): Promise<RefreshTokenRecord>;
  findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  /**
   * Atomically rotate. Must use a transaction with `SELECT … FOR UPDATE`
   * on the presented row to prevent two concurrent refresh requests
   * both succeeding. On reuse, lock and revoke every forward link before
   * committing, so rotation of a successor cannot escape revocation.
   */
  rotate(input: RotateRefreshTokenInput, now: Date): Promise<RotateRefreshTokenOutcome>;
  /**
   * Lock and revoke each listed row and all of its successors atomically.
   * Idempotent — already-revoked rows are left alone (their existing
   * `revoked_at` is preserved).
   */
  revokeChain(chainIds: readonly string[], revokedAt: Date): Promise<void>;
}
