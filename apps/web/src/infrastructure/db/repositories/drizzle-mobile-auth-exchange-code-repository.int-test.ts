import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createTestDb,
  type Db,
  type Sql,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';
import { DrizzleMobileAuthExchangeCodeRepository } from './drizzle-mobile-auth-exchange-code-repository';

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

describe('DrizzleMobileAuthExchangeCodeRepository', () => {
  it('atomically consumes a code once and preserves the first consumption time', async () => {
    const user = await seedUser(db, { isApproved: true });
    const repo = new DrizzleMobileAuthExchangeCodeRepository(db);
    const now = new Date();
    const row = await repo.create({
      codeHash: 'race',
      codeChallenge: 'challenge',
      userId: user.id,
      expiresAt: new Date(now.getTime() + 120_000),
    });
    const claims = await Promise.all(
      Array.from({ length: 4 }, () => repo.markConsumed(row.id, now)),
    );
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await repo.markConsumed(row.id, new Date(now.getTime() + 1_000))).toBe(false);
    expect((await repo.findByCodeHash('race'))?.consumedAt).toEqual(now);
  });

  it('cannot consume an expired code, including at the expiry boundary', async () => {
    const user = await seedUser(db, { isApproved: true });
    const repo = new DrizzleMobileAuthExchangeCodeRepository(db);
    const now = new Date();
    const row = await repo.create({
      codeHash: 'expired',
      codeChallenge: 'challenge',
      userId: user.id,
      expiresAt: now,
    });
    expect(await repo.markConsumed(row.id, now)).toBe(false);
    expect(await repo.markConsumed(row.id, new Date(now.getTime() + 1))).toBe(false);
  });

  it('round-trips a code via codeHash lookup', async () => {
    const user = await seedUser(db, { isApproved: true });
    const repo = new DrizzleMobileAuthExchangeCodeRepository(db);
    const expiresAt = new Date(Date.now() + 120_000);

    const created = await repo.create({
      codeHash: 'hash-abc',
      codeChallenge: 'challenge-xyz',
      userId: user.id,
      expiresAt,
    });

    expect(created.codeHash).toBe('hash-abc');
    expect(created.userId).toBe(user.id);
    expect(created.consumedAt).toBeNull();

    const found = await repo.findByCodeHash('hash-abc');
    expect(found?.id).toBe(created.id);
  });

  it('returns null for unknown codeHash', async () => {
    const repo = new DrizzleMobileAuthExchangeCodeRepository(db);
    expect(await repo.findByCodeHash('nope')).toBeNull();
  });

  it('markConsumed sets consumedAt without disturbing other fields', async () => {
    const user = await seedUser(db, { isApproved: true });
    const repo = new DrizzleMobileAuthExchangeCodeRepository(db);
    const created = await repo.create({
      codeHash: 'h1',
      codeChallenge: 'c1',
      userId: user.id,
      expiresAt: new Date(Date.now() + 120_000),
    });

    const consumedAt = new Date();
    await repo.markConsumed(created.id, consumedAt);

    const found = await repo.findByCodeHash('h1');
    expect(found?.consumedAt?.getTime()).toBe(consumedAt.getTime());
    expect(found?.codeChallenge).toBe('c1');
  });

  it('garbage-collects expired rows on insert', async () => {
    const user = await seedUser(db, { isApproved: true });
    const repo = new DrizzleMobileAuthExchangeCodeRepository(db);

    await repo.create({
      codeHash: 'old',
      codeChallenge: 'co',
      userId: user.id,
      expiresAt: new Date(Date.now() - 1_000),
    });
    expect(await repo.findByCodeHash('old')).not.toBeNull();

    await repo.create({
      codeHash: 'fresh',
      codeChallenge: 'cf',
      userId: user.id,
      expiresAt: new Date(Date.now() + 120_000),
    });

    expect(await repo.findByCodeHash('old')).toBeNull();
    expect(await repo.findByCodeHash('fresh')).not.toBeNull();
  });
});
