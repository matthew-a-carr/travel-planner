import { and, eq, inArray, isNull } from 'drizzle-orm';
import type {
  CreateRefreshTokenInput,
  RefreshTokenRepository,
  RotateRefreshTokenInput,
  RotateRefreshTokenOutcome,
} from '@/domain/auth/refresh-token-repository';
import type { RefreshTokenRecord } from '@/domain/auth/types';
import type { Db } from '../client';
import { refreshTokens } from '../schema';

export class DrizzleRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateRefreshTokenInput): Promise<RefreshTokenRecord> {
    const [row] = await this.db
      .insert(refreshTokens)
      .values({
        userId: input.userId,
        tokenHash: input.tokenHash,
        issuedAt: input.issuedAt,
        expiresAt: input.expiresAt,
      })
      .returning();
    if (!row) throw new Error('refresh_tokens insert returned no row');
    return toRecord(row);
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const rows = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async rotate(input: RotateRefreshTokenInput, now: Date): Promise<RotateRefreshTokenOutcome> {
    return this.db.transaction(async (tx) => {
      // SELECT FOR UPDATE — locks the row for the duration of the
      // transaction so concurrent refreshes serialise per ADR 051 §2.
      const lockedRows = await tx
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, input.presentedTokenHash))
        .for('update')
        .limit(1);

      const presented = lockedRows[0];
      if (!presented) return { kind: 'unknown' as const };

      if (presented.replacedById !== null) {
        // Walk the chain forward inside the same transaction so the
        // caller can revoke it atomically. Bounded by natural chain
        // length (rotations); audience-of-two won't produce long chains.
        type Row = typeof refreshTokens.$inferSelect;
        const chain: RefreshTokenRecord[] = [];
        let cursorId: string | null = presented.id;
        while (cursorId !== null) {
          const rows: Row[] = await tx
            .select()
            .from(refreshTokens)
            .where(eq(refreshTokens.id, cursorId))
            .limit(1);
          const row: Row | undefined = rows[0];
          if (!row) break;
          chain.push(toRecord(row));
          cursorId = row.replacedById;
        }
        return { kind: 'reused' as const, chain };
      }

      if (presented.revokedAt !== null) {
        return { kind: 'unusable' as const, reason: 'revoked' };
      }

      if (presented.expiresAt.getTime() < now.getTime()) {
        return { kind: 'unusable' as const, reason: 'expired' };
      }

      // Happy path: insert successor, link predecessor via replacedById.
      const [successor] = await tx
        .insert(refreshTokens)
        .values({
          userId: input.successor.userId,
          tokenHash: input.successor.tokenHash,
          issuedAt: input.successor.issuedAt,
          expiresAt: input.successor.expiresAt,
        })
        .returning();
      if (!successor) throw new Error('refresh_tokens successor insert returned no row');

      await tx
        .update(refreshTokens)
        .set({ replacedById: successor.id })
        .where(eq(refreshTokens.id, presented.id));

      return { kind: 'rotated' as const, successor: toRecord(successor) };
    });
  }

  async revokeChain(chainIds: readonly string[], revokedAt: Date): Promise<void> {
    if (chainIds.length === 0) return;
    // Only set revokedAt on rows that aren't already revoked — preserves
    // the original revocation time and makes the operation idempotent.
    await this.db
      .update(refreshTokens)
      .set({ revokedAt })
      .where(and(inArray(refreshTokens.id, chainIds as string[]), isNull(refreshTokens.revokedAt)));
  }
}

function toRecord(row: typeof refreshTokens.$inferSelect): RefreshTokenRecord {
  return {
    id: row.id,
    userId: row.userId,
    tokenHash: row.tokenHash,
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
    replacedById: row.replacedById,
    revokedAt: row.revokedAt,
  };
}
