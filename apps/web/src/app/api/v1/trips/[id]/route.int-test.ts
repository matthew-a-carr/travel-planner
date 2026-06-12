import { apiErrorEnvelopeSchema, apiSuccessSchema, tripDetailSchema } from '@travel-planner/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { signAccessToken } from '@/infrastructure/auth/bearer-token';
import {
  createTestDb,
  type Db,
  type Sql,
  seedDestination,
  seedFixedCost,
  seedOrganization,
  seedSpendEntry,
  seedTrip,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';

// Bearer path uses real signAccessToken; auth() is mocked only so the
// cookie path stays inert (no next-auth wiring needed for these tests).
vi.mock('@/infrastructure/auth', () => ({
  auth: vi.fn().mockResolvedValue(null),
}));

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

function getTrip(id: string, jwt?: string): Promise<Response> {
  const request = new Request(`http://localhost/api/v1/trips/${id}`, {
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
  });
  return GET(request, { params: Promise.resolve({ id }) });
}

const detailSuccessEnvelope = apiSuccessSchema(tripDetailSchema);

describe('GET /api/v1/trips/{id}', () => {
  it('returns 200 with the composite TripDetail for an org member (criteria 1 + 5)', async () => {
    const user = await seedUser(db, { isApproved: true });
    const org = await seedOrganization(db, user.id);
    const trip = await seedTrip(db, user.id, {
      organizationId: org.id,
      name: 'Japan 2026',
      totalBudgetPence: 500_000,
    });
    const tokyo = await seedDestination(db, trip.id, {
      name: 'Tokyo',
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-09'),
      estimatedBudgetPence: 250_000,
    });
    await seedFixedCost(db, trip.id, { label: 'Flights', amountPence: 120_000 });
    await seedSpendEntry(db, tokyo.id, { amountPence: 5_000 });

    const response = await getTrip(trip.id, await signAccessToken({ userId: user.id }));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const parsed = detailSuccessEnvelope.parse(await response.json());
    expect(parsed.data).toMatchObject({
      id: trip.id,
      name: 'Japan 2026',
      startDate: '2026-09-01',
      endDate: '2026-09-09',
    });
    expect(parsed.data.destinations).toHaveLength(1);
    expect(parsed.data.destinations[0]?.spent).toEqual({ amountPence: 5_000, currency: 'GBP' });
    expect(parsed.data.fixedCosts[0]?.label).toBe('Flights');
    expect(parsed.data.spend).toMatchObject({
      totalBudget: { amountPence: 500_000, currency: 'GBP' },
      fixedCosts: { amountPence: 120_000, currency: 'GBP' },
      allocated: { amountPence: 250_000, currency: 'GBP' },
      available: { amountPence: 130_000, currency: 'GBP' },
      spent: { amountPence: 5_000, currency: 'GBP' },
      isOverAllocated: false,
    });
    expect(parsed.request.path).toBe(`/api/v1/trips/${trip.id}`);
    expect(parsed.request.path_params).toEqual({ id: trip.id });
  });

  it('returns 404 not_found for a non-member of the trip organisation (criterion 2)', async () => {
    const owner = await seedUser(db, { isApproved: true });
    const org = await seedOrganization(db, owner.id);
    const trip = await seedTrip(db, owner.id, { organizationId: org.id });
    const outsider = await seedUser(db, { isApproved: true });

    const response = await getTrip(trip.id, await signAccessToken({ userId: outsider.id }));

    expect(response.status).toBe(404);
    const parsed = apiErrorEnvelopeSchema.parse(await response.json());
    expect(parsed.error.code).toBe('not_found');
  });

  it('returns 404 not_found for an unknown trip id (criterion 3)', async () => {
    const user = await seedUser(db, { isApproved: true });

    const response = await getTrip(crypto.randomUUID(), await signAccessToken({ userId: user.id }));

    expect(response.status).toBe(404);
    const parsed = apiErrorEnvelopeSchema.parse(await response.json());
    expect(parsed.error.code).toBe('not_found');
  });

  it('returns 401 unauthenticated without credentials (criterion 4)', async () => {
    const response = await getTrip(crypto.randomUUID());

    expect(response.status).toBe(401);
    const parsed = apiErrorEnvelopeSchema.parse(await response.json());
    expect(parsed.error.code).toBe('unauthenticated');
  });
});
