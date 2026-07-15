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
  seedOrganizationMember,
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

import { DELETE, GET, PATCH } from './route';

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

function patchTrip(id: string, jwt: string, body: unknown, key: string): Promise<Response> {
  return PATCH(
    new Request(`http://localhost/api/v1/trips/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

function deleteTrip(id: string, jwt: string, key: string): Promise<Response> {
  return DELETE(
    new Request(`http://localhost/api/v1/trips/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${jwt}`, 'Idempotency-Key': key },
    }),
    { params: Promise.resolve({ id }) },
  );
}

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

describe('PATCH /api/v1/trips/{id}', () => {
  it('updates editable trip fields and replays the exact response', async () => {
    const user = await seedUser(db, { isApproved: true });
    const org = await seedOrganization(db, user.id);
    const trip = await seedTrip(db, user.id, { organizationId: org.id });
    const jwt = await signAccessToken({ userId: user.id });
    const body = { name: 'Updated', totalBudgetPence: 700_000, status: 'active' };

    const first = await patchTrip(trip.id, jwt, body, 'update-trip');
    const replay = await patchTrip(trip.id, jwt, body, 'update-trip');

    expect(first.status).toBe(200);
    expect(await replay.json()).toEqual(await first.json());
    const detail = detailSuccessEnvelope.parse(await (await getTrip(trip.id, jwt)).json());
    expect(detail.data).toMatchObject({
      name: 'Updated',
      status: 'active',
      totalBudget: { amountPence: 700_000, currency: 'GBP' },
    });
  });

  it('collapses missing and inaccessible trips to not_found', async () => {
    const owner = await seedUser(db, { isApproved: true });
    const org = await seedOrganization(db, owner.id);
    const trip = await seedTrip(db, owner.id, { organizationId: org.id });
    const outsider = await seedUser(db, { isApproved: true });
    const jwt = await signAccessToken({ userId: outsider.id });
    const body = { name: 'Updated', totalBudgetPence: 700_000, status: 'active' };

    const inaccessible = await patchTrip(trip.id, jwt, body, 'inaccessible-update');
    const missing = await patchTrip(crypto.randomUUID(), jwt, body, 'missing-update');

    expect(inaccessible.status).toBe(404);
    expect(missing.status).toBe(404);
  });
});

describe('DELETE /api/v1/trips/{id}', () => {
  it('deletes as an organization owner and safely replays 204', async () => {
    const user = await seedUser(db, { isApproved: true });
    const org = await seedOrganization(db, user.id);
    const trip = await seedTrip(db, user.id, { organizationId: org.id });
    const jwt = await signAccessToken({ userId: user.id });

    const first = await deleteTrip(trip.id, jwt, 'delete-trip');
    const replay = await deleteTrip(trip.id, jwt, 'delete-trip');

    expect(first.status).toBe(204);
    expect(replay.status).toBe(204);
    expect(await getTrip(trip.id, jwt)).toHaveProperty('status', 404);
  });

  it('forbids a regular organization member from deleting', async () => {
    const owner = await seedUser(db, { isApproved: true });
    const member = await seedUser(db, { isApproved: true });
    const org = await seedOrganization(db, owner.id);
    await seedOrganizationMember(db, org.id, member.id);
    const trip = await seedTrip(db, owner.id, { organizationId: org.id });

    const response = await deleteTrip(
      trip.id,
      await signAccessToken({ userId: member.id }),
      'member-delete',
    );

    expect(response.status).toBe(403);
    expect(apiErrorEnvelopeSchema.parse(await response.json()).error.code).toBe('forbidden');
  });
});
