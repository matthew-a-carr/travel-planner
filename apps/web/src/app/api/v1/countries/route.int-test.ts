import { apiSuccessSchema, countryReferenceSummarySchema } from '@travel-planner/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { signAccessToken } from '@/infrastructure/auth/bearer-token';
import {
  createTestDb,
  type Db,
  type Sql,
  seedCountryReference,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';

vi.mock('@/infrastructure/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }));

import { GET } from './route';

let db: Db;
let sql: Sql;
beforeAll(() => ({ db, sql } = createTestDb()));
afterAll(async () => sql.end());
beforeEach(async () => truncateAll(db));

describe('GET /api/v1/countries', () => {
  it('returns canonical daily suggestions for every comfort level', async () => {
    const user = await seedUser(db, { isApproved: true });
    await seedCountryReference(db, {
      country: 'Japan',
      alpha2: 'JP',
      alpha3: 'JPN',
      avgDailyCostPence: 10_000,
    });
    const jwt = await signAccessToken({ userId: user.id });
    const response = await GET(
      new Request('http://localhost/api/v1/countries', {
        headers: { Authorization: `Bearer ${jwt}` },
      }),
    );
    const data = apiSuccessSchema(z.array(countryReferenceSummarySchema)).parse(
      await response.json(),
    ).data;
    expect(data[0]?.suggestedDailyBudget).toEqual({
      budget: { amountPence: 6_500, currency: 'GBP' },
      mid: { amountPence: 10_000, currency: 'GBP' },
      luxury: { amountPence: 18_000, currency: 'GBP' },
    });
  });

  it('requires authentication', async () => {
    expect((await GET(new Request('http://localhost/api/v1/countries'))).status).toBe(401);
  });
});
