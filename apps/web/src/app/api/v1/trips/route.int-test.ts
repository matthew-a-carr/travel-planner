import {
  apiErrorEnvelopeSchema,
  apiSuccessSchema,
  tripSummarySchema,
} from '@travel-planner/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { signAccessToken } from '@/infrastructure/auth/bearer-token';
import {
  createTestDb,
  type Db,
  type Sql,
  seedDestination,
  seedOrganization,
  seedTrip,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';

// Mock next-auth's auth() so the cookie path is controllable; the bearer
// path uses real signAccessToken + real Postgres via Testcontainers.
vi.mock('@/infrastructure/auth', () => ({
  auth: vi.fn(),
}));

import { auth } from '@/infrastructure/auth';
import { GET } from './route';

type MockSession = { user: { id: string; email: string; name: string } } | null;
type MockedAuth = {
  mockResolvedValue: (value: MockSession) => void;
  mockReset: () => void;
};
const mockedAuth = auth as unknown as MockedAuth;

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
  mockedAuth.mockReset();
  mockedAuth.mockResolvedValue(null);
});

function requestWithBearer(jwt: string): Request {
  return new Request('http://localhost/api/v1/trips', {
    headers: { Authorization: `Bearer ${jwt}` },
  });
}

const tripsSuccessEnvelope = apiSuccessSchema(z.array(tripSummarySchema));

describe('GET /api/v1/trips', () => {
  it('returns 200 with the member trips as TripSummary[] in the success envelope (criterion 1)', async () => {
    const user = await seedUser(db, { isApproved: true });
    const org = await seedOrganization(db, user.id);
    const trip = await seedTrip(db, user.id, {
      organizationId: org.id,
      name: 'Japan 2026',
      totalBudgetPence: 500_000,
    });
    const jwt = await signAccessToken({ userId: user.id });

    const response = await GET(requestWithBearer(jwt));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const parsed = tripsSuccessEnvelope.parse(await response.json());
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0]).toMatchObject({
      id: trip.id,
      name: 'Japan 2026',
      status: 'planning',
      totalBudget: { amountPence: 500_000, currency: 'GBP' },
      organizationId: org.id,
    });
    expect(parsed.request.path).toBe('/api/v1/trips');
    expect(parsed.request.method).toBe('GET');
  });

  it('does not leak trips across organisations (criterion 2)', async () => {
    const alice = await seedUser(db, { isApproved: true });
    const aliceOrg = await seedOrganization(db, alice.id);
    const aliceTrip = await seedTrip(db, alice.id, { organizationId: aliceOrg.id });

    const bob = await seedUser(db, { isApproved: true });
    const bobOrg = await seedOrganization(db, bob.id);
    const bobTrip = await seedTrip(db, bob.id, { organizationId: bobOrg.id });

    const aliceResponse = await GET(requestWithBearer(await signAccessToken({ userId: alice.id })));
    const bobResponse = await GET(requestWithBearer(await signAccessToken({ userId: bob.id })));

    const aliceData = tripsSuccessEnvelope.parse(await aliceResponse.json()).data;
    const bobData = tripsSuccessEnvelope.parse(await bobResponse.json()).data;

    expect(aliceData.map((t) => t.id)).toEqual([aliceTrip.id]);
    expect(bobData.map((t) => t.id)).toEqual([bobTrip.id]);
  });

  it('returns 200 with an empty list (not 404) for a user with no organisations (criterion 3)', async () => {
    const user = await seedUser(db, { isApproved: true });
    const jwt = await signAccessToken({ userId: user.id });

    const response = await GET(requestWithBearer(jwt));

    expect(response.status).toBe(200);
    const parsed = tripsSuccessEnvelope.parse(await response.json());
    expect(parsed.data).toEqual([]);
  });

  it('derives the date range from destinations, null when absent (criterion 4)', async () => {
    const user = await seedUser(db, { isApproved: true });
    const org = await seedOrganization(db, user.id);
    const datedTrip = await seedTrip(db, user.id, { organizationId: org.id, name: 'Dated' });
    await seedDestination(db, datedTrip.id, {
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-05'),
    });
    await seedDestination(db, datedTrip.id, {
      startDate: new Date('2026-09-10'),
      endDate: new Date('2026-09-21'),
    });
    const undatedTrip = await seedTrip(db, user.id, { organizationId: org.id, name: 'Undated' });

    const response = await GET(requestWithBearer(await signAccessToken({ userId: user.id })));

    const parsed = tripsSuccessEnvelope.parse(await response.json());
    const dated = parsed.data.find((t) => t.id === datedTrip.id);
    const undated = parsed.data.find((t) => t.id === undatedTrip.id);
    expect(dated?.startDate).toBe('2026-09-01');
    expect(dated?.endDate).toBe('2026-09-21');
    expect(undated?.startDate).toBeNull();
    expect(undated?.endDate).toBeNull();
  });

  it('returns 401 unauthenticated for an invalid bearer (criterion 5)', async () => {
    const response = await GET(requestWithBearer('bogus'));

    expect(response.status).toBe(401);
    const parsed = apiErrorEnvelopeSchema.parse(await response.json());
    expect(parsed.error.code).toBe('unauthenticated');
    expect(parsed.error.instance).toBe('/api/v1/trips');
  });

  it('returns 401 unauthenticated when no credentials are presented (criterion 5)', async () => {
    const response = await GET(new Request('http://localhost/api/v1/trips'));

    expect(response.status).toBe(401);
    const parsed = apiErrorEnvelopeSchema.parse(await response.json());
    expect(parsed.error.code).toBe('unauthenticated');
  });

  it('also serves the cookie-session path (web parity)', async () => {
    const user = await seedUser(db, { isApproved: true, email: 'cookie@example.com' });
    const org = await seedOrganization(db, user.id);
    const trip = await seedTrip(db, user.id, { organizationId: org.id });
    mockedAuth.mockResolvedValue({
      user: { id: user.id, email: 'cookie@example.com', name: 'Cookie User' },
    });

    const response = await GET(new Request('http://localhost/api/v1/trips'));

    expect(response.status).toBe(200);
    const parsed = tripsSuccessEnvelope.parse(await response.json());
    expect(parsed.data.map((t) => t.id)).toEqual([trip.id]);
  });

  it('returns 500 internal with a generic envelope on unexpected errors', async () => {
    mockedAuth.mockResolvedValue(null);
    const boom = new Request('http://localhost/api/v1/trips', {
      headers: { Authorization: 'Bearer ' },
    });
    // An empty bearer falls through to the cookie path; make auth() throw instead.
    (
      auth as unknown as { mockImplementation: (impl: () => Promise<never>) => void }
    ).mockImplementation(async () => {
      throw new Error('boom from auth()');
    });

    const response = await GET(boom);

    expect(response.status).toBe(500);
    const body = await response.json();
    const parsed = apiErrorEnvelopeSchema.parse(body);
    expect(parsed.error.code).toBe('internal');
    expect(JSON.stringify(body)).not.toContain('boom from auth()');
  });
});
