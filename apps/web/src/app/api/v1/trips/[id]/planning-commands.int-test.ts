import {
  apiErrorEnvelopeSchema,
  apiSuccessSchema,
  tripDestinationSchema,
  tripFixedCostSchema,
} from '@travel-planner/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { signAccessToken } from '@/infrastructure/auth/bearer-token';
import {
  createTestDb,
  type Db,
  type Sql,
  seedCountryReference,
  seedDestination,
  seedFixedCost,
  seedOrganization,
  seedTrip,
  seedUser,
  truncateAll,
} from '@/infrastructure/testing/helpers';

vi.mock('@/infrastructure/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }));

import {
  DELETE as deleteDestination,
  PATCH as updateDestination,
} from './destinations/[destinationId]/route';
import { POST as createDestination } from './destinations/route';
import {
  DELETE as deleteFixedCost,
  PATCH as updateFixedCost,
} from './fixed-costs/[fixedCostId]/route';
import { POST as createFixedCost } from './fixed-costs/route';

let db: Db;
let sql: Sql;

beforeAll(() => {
  ({ db, sql } = createTestDb());
});

afterAll(async () => sql.end());
beforeEach(async () => truncateAll(db));

function command(
  url: string,
  jwt: string,
  method: string,
  body?: unknown,
  key = crypto.randomUUID(),
) {
  return new Request(url, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function fixture() {
  const user = await seedUser(db, { isApproved: true });
  const organization = await seedOrganization(db, user.id);
  const trip = await seedTrip(db, user.id, {
    organizationId: organization.id,
    totalBudgetPence: 900_000,
  });
  await seedCountryReference(db, { country: 'Japan', alpha2: 'JP', alpha3: 'JPN' });
  return { user, trip, jwt: await signAccessToken({ userId: user.id }) };
}

const destinationBody = {
  name: 'Tokyo',
  country: 'Japan',
  city: 'Tokyo',
  latitude: 35.6762,
  longitude: 139.6503,
  estimatedBudgetPence: 200_000,
  comfortLevel: 'mid',
  startDate: '2027-04-01',
  endDate: '2027-04-08',
};
const fixedCostBody = {
  label: 'Flights',
  amountPence: 80_000,
  category: 'transport',
  date: '2027-03-30',
};

describe('destination v1 commands', () => {
  it('creates once and exactly replays a duplicate request', async () => {
    const { trip, jwt } = await fixture();
    const key = crypto.randomUUID();
    const url = `http://localhost/api/v1/trips/${trip.id}/destinations`;
    const first = await createDestination(command(url, jwt, 'POST', destinationBody, key), {
      params: Promise.resolve({ id: trip.id }),
    });
    const second = await createDestination(command(url, jwt, 'POST', destinationBody, key), {
      params: Promise.resolve({ id: trip.id }),
    });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(await second.json()).toEqual(await first.json());
    const saved = await db.query.destinations.findMany();
    expect(saved).toHaveLength(1);
    expect(
      apiSuccessSchema(tripDestinationSchema).parse(
        await createDestination(command(url, jwt, 'POST', { ...destinationBody, name: 'Osaka' }), {
          params: Promise.resolve({ id: trip.id }),
        }).then((r) => r.json()),
      ),
    ).toBeTruthy();
  });

  it('updates and deletes only a child of the accessible parent', async () => {
    const { trip, jwt } = await fixture();
    const destination = await seedDestination(db, trip.id, { name: 'Tokyo' });
    const otherTrip = await seedTrip(db, (await seedUser(db)).id);
    const wrongParent = await updateDestination(
      command(
        `http://localhost/api/v1/trips/${otherTrip.id}/destinations/${destination.id}`,
        jwt,
        'PATCH',
        destinationBody,
      ),
      { params: Promise.resolve({ id: otherTrip.id, destinationId: destination.id }) },
    );
    expect(wrongParent.status).toBe(404);
    expect(apiErrorEnvelopeSchema.parse(await wrongParent.json()).error.code).toBe('not_found');

    const updated = await updateDestination(
      command(
        `http://localhost/api/v1/trips/${trip.id}/destinations/${destination.id}`,
        jwt,
        'PATCH',
        { ...destinationBody, name: 'Tokyo updated' },
      ),
      { params: Promise.resolve({ id: trip.id, destinationId: destination.id }) },
    );
    expect(updated.status).toBe(200);
    expect(apiSuccessSchema(tripDestinationSchema).parse(await updated.json()).data.name).toBe(
      'Tokyo updated',
    );
    const removed = await deleteDestination(
      command(
        `http://localhost/api/v1/trips/${trip.id}/destinations/${destination.id}`,
        jwt,
        'DELETE',
      ),
      { params: Promise.resolve({ id: trip.id, destinationId: destination.id }) },
    );
    expect(removed.status).toBe(204);
  });
});

describe('fixed-cost v1 commands', () => {
  it('creates, updates, and deletes a fixed cost through canonical use cases', async () => {
    const { trip, jwt } = await fixture();
    const created = await createFixedCost(
      command(`http://localhost/api/v1/trips/${trip.id}/fixed-costs`, jwt, 'POST', fixedCostBody),
      { params: Promise.resolve({ id: trip.id }) },
    );
    expect(created.status).toBe(201);
    expect(apiSuccessSchema(tripFixedCostSchema).parse(await created.json()).data.label).toBe(
      'Flights',
    );
    const fixedCost = (await db.query.tripFixedCosts.findMany())[0];
    if (!fixedCost) throw new Error('Expected fixed cost');
    const updated = await updateFixedCost(
      command(
        `http://localhost/api/v1/trips/${trip.id}/fixed-costs/${fixedCost.id}`,
        jwt,
        'PATCH',
        { ...fixedCostBody, label: 'Premium flights' },
      ),
      { params: Promise.resolve({ id: trip.id, fixedCostId: fixedCost.id }) },
    );
    expect(apiSuccessSchema(tripFixedCostSchema).parse(await updated.json()).data.label).toBe(
      'Premium flights',
    );
    const removed = await deleteFixedCost(
      command(
        `http://localhost/api/v1/trips/${trip.id}/fixed-costs/${fixedCost.id}`,
        jwt,
        'DELETE',
      ),
      { params: Promise.resolve({ id: trip.id, fixedCostId: fixedCost.id }) },
    );
    expect(removed.status).toBe(204);
  });

  it('collapses inaccessible parent/child combinations to not-found', async () => {
    const { trip } = await fixture();
    const fixedCost = await seedFixedCost(db, trip.id);
    const stranger = await seedUser(db, { isApproved: true });
    const jwt = await signAccessToken({ userId: stranger.id });
    const response = await deleteFixedCost(
      command(
        `http://localhost/api/v1/trips/${trip.id}/fixed-costs/${fixedCost.id}`,
        jwt,
        'DELETE',
      ),
      { params: Promise.resolve({ id: trip.id, fixedCostId: fixedCost.id }) },
    );
    expect(response.status).toBe(404);
  });
});
