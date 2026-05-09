import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '@/infrastructure/db/client';
import { createAppContainer } from './create-app-container';
import { createTestAppContainer } from './create-test-app-container';
import type { AppContainer } from './types';

function createFakeContainer(): AppContainer {
  return {
    tripRepository: {} as AppContainer['tripRepository'],
    destinationRepository: {} as AppContainer['destinationRepository'],
    spendEntryRepository: {} as AppContainer['spendEntryRepository'],
    tripFixedCostRepository: {} as AppContainer['tripFixedCostRepository'],
    countryReferenceRepository: {} as AppContainer['countryReferenceRepository'],
    organizationRepository: {} as AppContainer['organizationRepository'],
    userAccessRepository: {} as AppContainer['userAccessRepository'],
    inviteEmailService: {} as AppContainer['inviteEmailService'],
    itineraryParser: {} as AppContainer['itineraryParser'],
    timelineInsightsService: {} as AppContainer['timelineInsightsService'],
    aiCacheRepository: {} as AppContainer['aiCacheRepository'],
    hashFn: ((s: string) => s) as AppContainer['hashFn'],
  };
}

describe('createAppContainer', () => {
  it('creates concrete defaults and supports targeted overrides', () => {
    const fakeDb = {} as Db;
    const fakeTripRepository = {} as AppContainer['tripRepository'];

    const container = createAppContainer({
      dbClient: fakeDb,
      overrides: {
        tripRepository: fakeTripRepository,
      },
    });

    expect(container.tripRepository).toBe(fakeTripRepository);
    expect(container.organizationRepository).toBeDefined();
    expect(container.userAccessRepository).toBeDefined();
    expect(container.inviteEmailService).toBeDefined();
  });
});

describe('createTestAppContainer', () => {
  it('builds real defaults with optional overrides for tests', () => {
    const fakeDb = {} as Db;
    const fakeOrganizationRepository = {} as AppContainer['organizationRepository'];

    const container = createTestAppContainer({
      dbClient: fakeDb,
      overrides: {
        organizationRepository: fakeOrganizationRepository,
      },
    });

    expect(container.organizationRepository).toBe(fakeOrganizationRepository);
    expect(container.tripRepository).toBeDefined();
    expect(container.destinationRepository).toBeDefined();
    expect(container.inviteEmailService).toBeDefined();
  });
});

describe('getAppContainer', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns a singleton instance for repeated calls', async () => {
    const fakeDb = {} as Db;
    const fakeContainer = createFakeContainer();
    const createSpy = vi.fn(() => fakeContainer);

    vi.doMock('@/infrastructure/db/client', () => ({
      db: fakeDb,
    }));
    vi.doMock('./create-app-container', () => ({
      createAppContainer: createSpy,
    }));

    const { getAppContainer } = await import('./index');

    const first = getAppContainer();
    const second = getAppContainer();

    expect(first).toBe(fakeContainer);
    expect(second).toBe(first);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledWith({ dbClient: fakeDb });
  });
});
