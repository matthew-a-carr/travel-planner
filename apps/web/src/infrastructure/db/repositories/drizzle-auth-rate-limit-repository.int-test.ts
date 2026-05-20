import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Db, type Sql, truncateAll } from '@/infrastructure/testing/helpers';
import { DrizzleAuthRateLimitRepository } from './drizzle-auth-rate-limit-repository';

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

const FIVE_MIN_MS = 5 * 60 * 1000;

describe('DrizzleAuthRateLimitRepository', () => {
  it('counts attempts inside the sliding window only', async () => {
    const repo = new DrizzleAuthRateLimitRepository(db);
    const now = new Date('2026-05-20T12:00:00Z');

    // Three attempts inside the window:
    for (let i = 0; i < 3; i += 1) {
      await repo.recordAndCount({
        key: 'ip:1.2.3.4',
        endpoint: 'start',
        occurredAt: new Date(now.getTime() - i * 60_000),
        windowMs: FIVE_MIN_MS,
      });
    }

    // One attempt OUTSIDE the window (10 min ago).
    await repo.recordAndCount({
      key: 'ip:1.2.3.4',
      endpoint: 'start',
      occurredAt: new Date(now.getTime() - 10 * 60_000),
      windowMs: FIVE_MIN_MS,
    });

    // Now record another inside the window — the count should include
    // the three recents + the new one = 4 (the 10-min-ago one is out
    // of window).
    const { windowCount } = await repo.recordAndCount({
      key: 'ip:1.2.3.4',
      endpoint: 'start',
      occurredAt: now,
      windowMs: FIVE_MIN_MS,
    });

    expect(windowCount).toBe(4);
  });

  it('isolates counts by key', async () => {
    const repo = new DrizzleAuthRateLimitRepository(db);
    const now = new Date();

    for (let i = 0; i < 5; i += 1) {
      await repo.recordAndCount({
        key: 'ip:1.1.1.1',
        endpoint: 'start',
        occurredAt: now,
        windowMs: FIVE_MIN_MS,
      });
    }

    const second = await repo.recordAndCount({
      key: 'ip:2.2.2.2',
      endpoint: 'start',
      occurredAt: now,
      windowMs: FIVE_MIN_MS,
    });

    expect(second.windowCount).toBe(1);
  });

  it('gcOlderThan removes only stale rows for the key', async () => {
    const repo = new DrizzleAuthRateLimitRepository(db);
    const now = new Date('2026-05-20T12:00:00Z');

    await repo.recordAndCount({
      key: 'ip:k',
      endpoint: 'start',
      occurredAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2h ago
      windowMs: FIVE_MIN_MS,
    });
    await repo.recordAndCount({
      key: 'ip:k',
      endpoint: 'start',
      occurredAt: now,
      windowMs: FIVE_MIN_MS,
    });

    const deleted = await repo.gcOlderThan(
      'ip:k',
      new Date(now.getTime() - 60 * 60 * 1000), // 1h cutoff
    );

    expect(deleted).toBe(1);

    const { windowCount } = await repo.recordAndCount({
      key: 'ip:k',
      endpoint: 'start',
      occurredAt: now,
      windowMs: FIVE_MIN_MS,
    });
    expect(windowCount).toBe(2); // the recent one + this new one
  });
});
