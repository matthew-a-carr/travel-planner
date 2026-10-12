import { Children, isValidElement, type ReactElement, type ReactNode, Suspense } from 'react';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { auth } from '@/infrastructure/auth';
import { getAppContainer } from '@/infrastructure/container';
import { createTestAppContainer } from '@/infrastructure/container/create-test-app-container';
import { getAuthenticatedAccessContext } from '@/infrastructure/organization/active-organization';
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
import TripDetailPage from './page';
import TripTimelinePage from './timeline/page';

vi.mock('@/infrastructure/auth', () => ({ auth: vi.fn() }));
vi.mock('@/infrastructure/container', () => ({ getAppContainer: vi.fn(() => ({})) }));
vi.mock('@/infrastructure/organization/active-organization', () => ({
  getAuthenticatedAccessContext: vi.fn(),
}));

let db: Db;
let sql: Sql;
beforeAll(() => {
  ({ db, sql } = createTestDb());
});
afterAll(async () => {
  await sql.end();
});
beforeEach(async () => {
  vi.restoreAllMocks();
  await truncateAll(db);
});

function suspenseChild(node: ReactNode): ReactElement<Record<string, unknown>> | undefined {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode }>(child)) continue;
    if (child.type === Suspense && isValidElement<Record<string, unknown>>(child.props.children))
      return child.props.children;
    const nested = suspenseChild(child.props.children);
    if (nested) return nested;
  }
}

it.each([
  ['overview', TripDetailPage],
  ['timeline', TripTimelinePage],
] as const)(
  '%s returns its main content before AI and reads each panel input only once',
  async (_name, page) => {
    const user = await seedUser(db);
    const organization = await seedOrganization(db, user.id);
    const trip = await seedTrip(db, user.id, { organizationId: organization.id });
    const destination = await seedDestination(db, trip.id, {
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-10'),
    });
    await seedFixedCost(db, trip.id);
    await seedSpendEntry(db, destination.id);
    const organizations = [
      {
        organization: { ...organization, createdAt: new Date(), updatedAt: new Date() },
        role: 'owner' as const,
      },
    ];
    // Only the HTTP/session boundary and external AI are stubbed. All repositories use Postgres.
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id }, expires: '2099-01-01' } as never);
    vi.mocked(getAuthenticatedAccessContext).mockResolvedValue({
      userId: user.id,
      organizations,
      activeOrganization: organizations[0],
    });
    const gate = Promise.withResolvers<void>();
    const narrative = vi.fn(async () => {
      await gate.promise;
      return { ok: true as const, result: { narrative: 'Budget remains on track.', bullets: [] } };
    });
    const insights = vi.fn(async () => {
      await gate.promise;
      return { ok: true as const, findings: [] };
    });
    const container = createTestAppContainer({
      dbClient: db,
      overrides: {
        tripNarrativeService: { summarise: narrative },
        timelineInsightsService: { analyse: insights },
      },
    });
    vi.mocked(getAppContainer).mockReturnValue(container);
    const tripReads = vi.spyOn(container.tripRepository, 'findById');
    const destinationReads = vi.spyOn(container.destinationRepository, 'findByTrip');
    const costReads = vi.spyOn(container.tripFixedCostRepository, 'findByTrip');
    const spendReads = vi.spyOn(container.spendEntryRepository, 'findByTrip');
    const referenceReads = vi.spyOn(container.countryReferenceRepository, 'findAll');
    const render = page({ params: Promise.resolve({ id: trip.id }) });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const tree = await Promise.race([
        render,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Main page blocked on pending AI')), 1000);
        }),
      ]);
      const child = suspenseChild(tree);
      expect(child, 'AI panel must have a streaming boundary').toBeDefined();
      if (!child || typeof child.type !== 'function') throw new Error('Missing async panel');
      const panel = (child.type as (props: Record<string, unknown>) => Promise<ReactNode>)(
        child.props,
      );
      await vi.waitFor(() =>
        expect(_name === 'overview' ? narrative : insights).toHaveBeenCalledOnce(),
      );
      expect(_name === 'overview' ? narrative : insights).toHaveBeenCalledWith(
        expect.objectContaining({
          destinations: [expect.objectContaining({ id: destination.id })],
        }),
      );
      expect(tripReads).toHaveBeenCalledOnce();
      // Overview still has a separate visa assessment read; the AI panel adds none.
      expect(destinationReads).toHaveBeenCalledTimes(_name === 'overview' ? 2 : 1);
      expect(costReads).toHaveBeenCalledOnce();
      if (_name === 'overview') expect(spendReads).toHaveBeenCalledOnce();
      else expect(referenceReads).toHaveBeenCalledOnce();
      gate.resolve();
      expect(await panel).toBeDefined();
    } finally {
      clearTimeout(timer);
      gate.resolve();
      await render;
    }
  },
);
