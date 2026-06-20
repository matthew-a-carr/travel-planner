import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type Db, type Sql, truncateAll } from '../testing/helpers';
import { ingestVisaData } from './ingest-visa-rules';
import { visaRules, visaZones } from './schema';

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

describe('ingestVisaData', () => {
  it('idempotently upserts zones + the hand-authored visa rules', async () => {
    const first = await ingestVisaData(db);
    expect(first.zones).toBeGreaterThan(0);
    expect(first.rules).toBeGreaterThan(0);

    const zones = await db.select().from(visaZones);
    expect(zones.some((z) => z.code === 'SCHENGEN')).toBe(true);

    const rules = await db.select().from(visaRules);
    expect(rules.length).toBe(first.rules);
    // The Australia working-holiday rule is part of the manual seed.
    expect(rules.some((r) => r.destination === 'AUS' && r.purpose === 'working-holiday')).toBe(
      true,
    );

    // Running again must not duplicate (idempotent upsert on the unique index).
    await ingestVisaData(db);
    const afterSecond = await db.select().from(visaRules);
    expect(afterSecond.length).toBe(rules.length);
  });
});
