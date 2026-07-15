import {
  apiErrorEnvelopeSchema,
  apiSuccessSchema,
  organizationSummarySchema,
} from '@travel-planner/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { signAccessToken } from '@/infrastructure/auth/bearer-token';
import {
  createTestDb,
  type Db,
  type Sql,
  seedOrganization,
  seedOrganizationMember,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';

vi.mock('@/infrastructure/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }));

import { GET } from './route';

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

describe('GET /api/v1/organizations', () => {
  it('returns only the organizations the bearer belongs to with their roles', async () => {
    const owner = await seedUser(db, { isApproved: true });
    const member = await seedUser(db, { isApproved: true });
    const owned = await seedOrganization(db, owner.id, { name: 'Owned' });
    const joined = await seedOrganization(db, member.id, { name: 'Joined' });
    await seedOrganizationMember(db, joined.id, owner.id);
    await seedOrganization(db, member.id, { name: 'Hidden' });

    const response = await GET(
      new Request('http://localhost/api/v1/organizations', {
        headers: { Authorization: `Bearer ${await signAccessToken({ userId: owner.id })}` },
      }),
    );

    expect(response.status).toBe(200);
    const parsed = apiSuccessSchema(z.array(organizationSummarySchema)).parse(
      await response.json(),
    );
    expect(parsed.data).toEqual([
      { id: owned.id, name: 'Owned', role: 'owner' },
      { id: joined.id, name: 'Joined', role: 'member' },
    ]);
  });

  it('returns unauthenticated without credentials', async () => {
    const response = await GET(new Request('http://localhost/api/v1/organizations'));

    expect(response.status).toBe(401);
    expect(apiErrorEnvelopeSchema.parse(await response.json()).error.code).toBe('unauthenticated');
  });
});
