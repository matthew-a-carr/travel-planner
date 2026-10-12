import { eq } from 'drizzle-orm';
import type {
  CreateRefreshTokenInput,
  RefreshTokenRepository,
  RotateRefreshTokenInput,
  RotateRefreshTokenOutcome,
} from '@/domain/auth/refresh-token-repository';
import type { RefreshTokenRecord } from '@/domain/auth/types';
import type { Db, DbSession } from '../client';
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
        const chain = await revokeForward(tx, [presented.id], now);
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
    await this.db.transaction((tx) => revokeForward(tx, chainIds, revokedAt));
  }
}

/** Lock forward before revoking so concurrent rotation cannot escape the chain. */
async function revokeForward(
  tx: DbSession,
  chainIds: readonly string[],
  revokedAt: Date,
): Promise<RefreshTokenRecord[]> {
  const chain: RefreshTokenRecord[] = [];
  for (const id of chainIds) {
    let cursorId: string | null = id;
    while (cursorId !== null) {
      const rows: (typeof refreshTokens.$inferSelect)[] = await tx
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.id, cursorId))
        .for('update')
        .limit(1);
      const row = rows[0];
      if (!row) break;
      if (row.revokedAt === null) {
        await tx.update(refreshTokens).set({ revokedAt }).where(eq(refreshTokens.id, row.id));
      }
      chain.push(toRecord({ ...row, revokedAt: row.revokedAt ?? revokedAt }));
      cursorId = row.replacedById;
    }
  }
  return chain;
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
