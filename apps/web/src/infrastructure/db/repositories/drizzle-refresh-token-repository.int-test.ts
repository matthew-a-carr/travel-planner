import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { DrizzleRefreshTokenRepository } from './drizzle-refresh-token-repository';

let db: Db;
let sql: Sql;

beforeAll(() => {
  ({ db, sql } = createTestDb());
});

afterAll(async () => {
  await sql.end();
});

beforeEach(async () => {
  await truncateAll(db);
});

const HOUR = 60 * 60 * 1000;

describe('DrizzleRefreshTokenRepository', () => {
  it('creates and reads a refresh token by hash', async () => {
    const user = await seedUser(db, { isApproved: true });
    const repo = new DrizzleRefreshTokenRepository(db);

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 30 * 24 * HOUR);
    const created = await repo.create({
      userId: user.id,
      tokenHash: 'hash-1',
      issuedAt,
      expiresAt,
    });

    expect(created.userId).toBe(user.id);
    expect(created.tokenHash).toBe('hash-1');
    expect(created.replacedById).toBeNull();
    expect(created.revokedAt).toBeNull();

    const found = await repo.findByTokenHash('hash-1');
    expect(found?.id).toBe(created.id);
  });

  it('rotates a healthy token, linking predecessor via replacedById', async () => {
    const user = await seedUser(db, { isApproved: true });
    const repo = new DrizzleRefreshTokenRepository(db);
    const now = new Date();

    const pred = await repo.create({
      userId: user.id,
      tokenHash: 'pred-hash',
      issuedAt: now,
      expiresAt: new Date(now.getTime() + 30 * 24 * HOUR),
    });

    const outcome = await repo.rotate(
      {
        presentedTokenHash: 'pred-hash',
        successor: {
          userId: user.id,
          tokenHash: 'succ-hash',
          issuedAt: now,
          expiresAt: new Date(now.getTime() + 30 * 24 * HOUR),
        },
      },
      now,
    );

    expect(outcome.kind).toBe('rotated');
    if (outcome.kind !== 'rotated') throw new Error('unreachable');

    expect(outcome.successor.tokenHash).toBe('succ-hash');

    const predAfter = await repo.findByTokenHash('pred-hash');
    expect(predAfter?.replacedById).toBe(outcome.successor.id);
    expect(predAfter?.id).toBe(pred.id);
  });

  it('returns reused with the full chain when rotation is attempted twice', async () => {
    const user = await seedUser(db, { isApproved: true });
    const repo = new DrizzleRefreshTokenRepository(db);
    const now = new Date();
    const exp = new Date(now.getTime() + 30 * 24 * HOUR);

    await repo.create({ userId: user.id, tokenHash: 't1', issuedAt: now, expiresAt: exp });

    // First rotation — happy path.
    const first = await repo.rotate(
      {
        presentedTokenHash: 't1',
        successor: { userId: user.id, tokenHash: 't2', issuedAt: now, expiresAt: exp },
      },
      now,
    );
    expect(first.kind).toBe('rotated');

    // Second rotation presenting the same (now-rotated) hash — reuse.
    const second = await repo.rotate(
      {
        presentedTokenHash: 't1',
        successor: { userId: user.id, tokenHash: 't3', issuedAt: now, expiresAt: exp },
      },
      now,
    );

    expect(second.kind).toBe('reused');
    if (second.kind !== 'reused') throw new Error('unreachable');
    expect(second.chain.map((r) => r.tokenHash)).toEqual(['t1', 't2']);
  });

  it('returns unusable=expired for an expired but non-rotated token', async () => {
    const user = await seedUser(db, { isApproved: true });
    const repo = new DrizzleRefreshTokenRepository(db);
    const issuedAt = new Date(Date.now() - 31 * 24 * HOUR);
    const expiresAt = new Date(Date.now() - HOUR);

    await repo.create({
      userId: user.id,
      tokenHash: 'expired-hash',
      issuedAt,
      expiresAt,
    });

    const outcome = await repo.rotate(
      {
        presentedTokenHash: 'expired-hash',
        successor: {
          userId: user.id,
          tokenHash: 'new-hash',
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 30 * 24 * HOUR),
        },
      },
      new Date(),
    );

    expect(outcome).toEqual({ kind: 'unusable', reason: 'expired' });
  });

  it('returns unknown for a token hash with no row', async () => {
    const repo = new DrizzleRefreshTokenRepository(db);
    const outcome = await repo.rotate(
      {
        presentedTokenHash: 'never-existed',
        successor: {
          userId: 'irrelevant',
          tokenHash: 'whatever',
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + HOUR),
        },
      },
      new Date(),
    );
    expect(outcome).toEqual({ kind: 'unknown' });
  });

  it('revokeChain sets revokedAt only on rows not already revoked', async () => {
    const user = await seedUser(db, { isApproved: true });
    const repo = new DrizzleRefreshTokenRepository(db);
    const now = new Date();
    const exp = new Date(now.getTime() + 30 * 24 * HOUR);

    const r1 = await repo.create({
      userId: user.id,
      tokenHash: 'r1',
      issuedAt: now,
      expiresAt: exp,
    });
    const r2 = await repo.create({
      userId: user.id,
      tokenHash: 'r2',
      issuedAt: now,
      expiresAt: exp,
    });

    // Pre-revoke r2 with an earlier time so we can verify it's not bumped.
    const earlierRevoke = new Date(now.getTime() - HOUR);
    await repo.revokeChain([r2.id], earlierRevoke);

    const laterRevoke = new Date();
    await repo.revokeChain([r1.id, r2.id], laterRevoke);

    const r1After = await repo.findByTokenHash('r1');
    const r2After = await repo.findByTokenHash('r2');
    expect(r1After?.revokedAt?.getTime()).toBe(laterRevoke.getTime());
    expect(r2After?.revokedAt?.getTime()).toBe(earlierRevoke.getTime());
  });

  it('rotate uses SELECT FOR UPDATE — concurrent calls produce one rotate + one reuse', async () => {
    const user = await seedUser(db, { isApproved: true });
    const repo = new DrizzleRefreshTokenRepository(db);
    const now = new Date();
    const exp = new Date(now.getTime() + 30 * 24 * HOUR);

    await repo.create({ userId: user.id, tokenHash: 'race', issuedAt: now, expiresAt: exp });

    // Fire both rotations concurrently. The transactional FOR UPDATE
    // lock should serialise them: one becomes 'rotated', the second
    // sees the now-rotated row and returns 'reused'.
    const [a, b] = await Promise.all([
      repo.rotate(
        {
          presentedTokenHash: 'race',
          successor: { userId: user.id, tokenHash: 'race-a', issuedAt: now, expiresAt: exp },
        },
        now,
      ),
      repo.rotate(
        {
          presentedTokenHash: 'race',
          successor: { userId: user.id, tokenHash: 'race-b', issuedAt: now, expiresAt: exp },
        },
        now,
      ),
    ]);

    const kinds = [a.kind, b.kind].sort();
    expect(kinds).toEqual(['reused', 'rotated']);
  });
});
