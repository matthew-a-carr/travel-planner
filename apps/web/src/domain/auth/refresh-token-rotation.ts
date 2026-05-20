/**
 * Pure refresh-token rotation decision logic per ADR 051 §2.
 *
 * The use case loads the presented refresh-token row (and, if it's been
 * rotated already, the rest of the chain). This function classifies the
 * outcome into one of five tagged variants. All IO and mutation happen
 * outside the domain layer.
 *
 * Decision precedence (matters when multiple flags apply simultaneously):
 *
 *   1. presented row missing      → unknown_token
 *   2. replacedById set           → reused  (overrides everything else
 *                                            below — an attacker holding
 *                                            a rotated token must still
 *                                            trigger chain revocation
 *                                            even if the token expired)
 *   3. revokedAt set              → revoked
 *   4. expiresAt < now            → expired
 *   5. otherwise                  → rotate
 */

import type { RefreshTokenRecord, RotationDecision } from './types';

export type DecideRotationInput = {
  readonly now: Date;
  readonly presented: RefreshTokenRecord | null;
  /**
   * Successor rows reachable by following `replacedById` forward from
   * the presented row. Must be in chain order (oldest first). Empty
   * when the presented row has never been rotated.
   */
  readonly chainFromPresented: readonly RefreshTokenRecord[];
};

export function decideRotation(input: DecideRotationInput): RotationDecision {
  const { now, presented, chainFromPresented } = input;

  if (presented === null) return { kind: 'unknown_token' };

  if (presented.replacedById !== null) {
    return {
      kind: 'reused',
      chainIdsToRevoke: [presented.id, ...chainFromPresented.map((row) => row.id)],
    };
  }

  if (presented.revokedAt !== null) return { kind: 'revoked' };

  if (presented.expiresAt.getTime() < now.getTime()) return { kind: 'expired' };

  return { kind: 'rotate', presentedId: presented.id };
}
