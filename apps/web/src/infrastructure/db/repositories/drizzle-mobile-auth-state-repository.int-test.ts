import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Db, type Sql, truncateAll } from '@/infrastructure/testing/helpers';
import { DrizzleMobileAuthStateRepository } from './drizzle-mobile-auth-state-repository';

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

describe('DrizzleMobileAuthStateRepository', () => {
  it('creates a row and retrieves it by state', async () => {
    const repo = new DrizzleMobileAuthStateRepository(db);
    const expiresAt = new Date(Date.now() + 120_000);

    const created = await repo.create({
      state: 'state-abc',
      codeChallenge: 'challenge-xyz',
      expiresAt,
    });

    expect(created.state).toBe('state-abc');
    expect(created.codeChallenge).toBe('challenge-xyz');
    expect(created.consumedAt).toBeNull();
    expect(created.expiresAt.getTime()).toBe(expiresAt.getTime());

    const found = await repo.findByState('state-abc');
    expect(found?.id).toBe(created.id);
  });

  it('returns null for unknown state', async () => {
    const repo = new DrizzleMobileAuthStateRepository(db);
    const found = await repo.findByState('does-not-exist');
    expect(found).toBeNull();
  });

  it('marks a row consumed', async () => {
    const repo = new DrizzleMobileAuthStateRepository(db);
    const row = await repo.create({
      state: 'state-1',
      codeChallenge: 'c1',
      expiresAt: new Date(Date.now() + 120_000),
    });

    const consumedAt = new Date();
    await repo.markConsumed(row.id, consumedAt);

    const refreshed = await repo.findByState('state-1');
    expect(refreshed?.consumedAt?.getTime()).toBe(consumedAt.getTime());
  });

  it('garbage-collects expired rows on insert', async () => {
    const repo = new DrizzleMobileAuthStateRepository(db);

    // Insert an already-expired row directly via the repo (via a past
    // expiresAt). Then insert another and confirm only the new one
    // survives.
    const expired = await repo.create({
      state: 'expired-state',
      codeChallenge: 'c-old',
      expiresAt: new Date(Date.now() - 60_000),
    });
    expect(await repo.findByState('expired-state')).not.toBeNull();

    await repo.create({
      state: 'fresh-state',
      codeChallenge: 'c-new',
      expiresAt: new Date(Date.now() + 120_000),
    });

    expect(await repo.findByState('expired-state')).toBeNull();
    expect((await repo.findByState('fresh-state'))?.codeChallenge).toBe('c-new');
    expect(expired.id).toBeTruthy();
  });
});
