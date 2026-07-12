import {
  apiErrorEnvelopeSchema,
  apiSuccessSchema,
  spendEntrySchema,
  tripFinancialsSchema,
} from '@travel-planner/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { signAccessToken } from '@/infrastructure/auth/bearer-token';
import {
  createTestDb,
  type Db,
  type Sql,
  seedDestination,
  seedOrganization,
  seedSpendEntry,
  seedTrip,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';

vi.mock('@/infrastructure/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }));

import { DELETE as deleteSpend, PATCH as updateSpend } from './spend/[entryId]/route';
import { POST as createSpend, GET as getFinancials } from './spend/route';

let db: Db;
let sql: Sql;

beforeAll(() => {
  ({ db, sql } = createTestDb());
});
afterAll(async () => sql.end());
beforeEach(async () => truncateAll(db));

function request(url: string, jwt: string, method = 'GET', body?: unknown, key?: string) {
  return new Request(url, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(key === undefined ? {} : { 'Idempotency-Key': key }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function fixture() {
  const user = await seedUser(db, { isApproved: true });
  const organization = await seedOrganization(db, user.id);
  const trip = await seedTrip(db, user.id, { organizationId: organization.id });
  const destination = await seedDestination(db, trip.id, {
    startDate: new Date('2026-06-01T00:00:00Z'),
    endDate: new Date('2026-06-21T00:00:00Z'),
    estimatedBudgetPence: 100_000,
  });
  return { user, trip, destination, jwt: await signAccessToken({ userId: user.id }) };
}

const body = {
  amountPence: 2500,
  category: 'food',
  description: 'Ramen',
  spentAt: '2026-06-02',
};

describe('trip spend v1 routes', () => {
  it('reads canonical financial insight for an accessible trip', async () => {
    const { trip, destination, jwt } = await fixture();
    await seedSpendEntry(db, destination.id, {
      ...body,
      spentAt: new Date(`${body.spentAt}T00:00:00Z`),
    });

    const response = await getFinancials(
      request(`http://localhost/api/v1/trips/${trip.id}/spend`, jwt),
      { params: Promise.resolve({ id: trip.id }) },
    );

    expect(response.status).toBe(200);
    const financials = apiSuccessSchema(tripFinancialsSchema).parse(await response.json()).data;
    expect(financials.entries).toHaveLength(1);
    expect(financials.categoryTotals).toEqual([{ category: 'food', amountPence: 2500 }]);
    expect(financials.burndown).not.toBeNull();
  });

  it('creates once and exactly replays a duplicate command', async () => {
    const { trip, destination, jwt } = await fixture();
    const key = crypto.randomUUID();
    const url = `http://localhost/api/v1/trips/${trip.id}/spend`;
    const createBody = { ...body, destinationId: destination.id };
    const first = await createSpend(request(url, jwt, 'POST', createBody, key), {
      params: Promise.resolve({ id: trip.id }),
    });
    const second = await createSpend(request(url, jwt, 'POST', createBody, key), {
      params: Promise.resolve({ id: trip.id }),
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(await second.json()).toEqual(await first.json());
    expect(await db.query.spendEntries.findMany()).toHaveLength(1);
  });

  it('rejects a destination outside the accessible parent', async () => {
    const { trip, jwt } = await fixture();
    const otherUser = await seedUser(db);
    const otherTrip = await seedTrip(db, otherUser.id);
    const otherDestination = await seedDestination(db, otherTrip.id);

    const response = await createSpend(
      request(
        `http://localhost/api/v1/trips/${trip.id}/spend`,
        jwt,
        'POST',
        { ...body, destinationId: otherDestination.id },
        crypto.randomUUID(),
      ),
      { params: Promise.resolve({ id: trip.id }) },
    );

    expect(response.status).toBe(404);
    expect(apiErrorEnvelopeSchema.parse(await response.json()).error.code).toBe('not_found');
  });

  it('updates and deletes only an entry belonging to the path trip', async () => {
    const { trip, destination, jwt } = await fixture();
    const entry = await seedSpendEntry(db, destination.id, {
      ...body,
      spentAt: new Date(`${body.spentAt}T00:00:00Z`),
    });
    const otherUser = await seedUser(db);
    const otherTrip = await seedTrip(db, otherUser.id);
    const wrongParent = await updateSpend(
      request(
        `http://localhost/api/v1/trips/${otherTrip.id}/spend/${entry.id}`,
        jwt,
        'PATCH',
        body,
        crypto.randomUUID(),
      ),
      { params: Promise.resolve({ id: otherTrip.id, entryId: entry.id }) },
    );
    expect(wrongParent.status).toBe(404);

    const updated = await updateSpend(
      request(
        `http://localhost/api/v1/trips/${trip.id}/spend/${entry.id}`,
        jwt,
        'PATCH',
        { ...body, amountPence: 4200, category: 'activities' },
        crypto.randomUUID(),
      ),
      { params: Promise.resolve({ id: trip.id, entryId: entry.id }) },
    );
    expect(apiSuccessSchema(spendEntrySchema).parse(await updated.json()).data).toMatchObject({
      amount: { amountPence: 4200, currency: 'GBP' },
      category: 'activities',
    });

    const removed = await deleteSpend(
      request(
        `http://localhost/api/v1/trips/${trip.id}/spend/${entry.id}`,
        jwt,
        'DELETE',
        undefined,
        crypto.randomUUID(),
      ),
      { params: Promise.resolve({ id: trip.id, entryId: entry.id }) },
    );
    expect(removed.status).toBe(204);
    expect(await db.query.spendEntries.findMany()).toHaveLength(0);
  });
});
