import { createAiServices } from '@/infrastructure/ai/create-ai-services';
import { DrizzleAiCacheRepository } from '@/infrastructure/ai/drizzle-ai-cache-repository';
import { sha256 } from '@/infrastructure/ai/hash';
import type { Db } from '@/infrastructure/db/client';
import { DrizzleCountryReferenceRepository } from '@/infrastructure/db/repositories/drizzle-country-reference-repository';
import { DrizzleDestinationRepository } from '@/infrastructure/db/repositories/drizzle-destination-repository';
import { DrizzleOrganizationRepository } from '@/infrastructure/db/repositories/drizzle-organization-repository';
import { DrizzleSpendEntryRepository } from '@/infrastructure/db/repositories/drizzle-spend-entry-repository';
import { DrizzleTripFixedCostRepository } from '@/infrastructure/db/repositories/drizzle-trip-fixed-cost-repository';
import { DrizzleTripRepository } from '@/infrastructure/db/repositories/drizzle-trip-repository';
import { DrizzleUserAccessRepository } from '@/infrastructure/db/repositories/drizzle-user-access-repository';
import { createInviteEmailService } from '@/infrastructure/email/create-invite-email-service';
import type { AppContainer } from './types';

export type CreateAppContainerInput = {
  readonly dbClient: Db;
  readonly overrides?: Partial<AppContainer>;
};

export function createAppContainer(input: CreateAppContainerInput): AppContainer {
  const { dbClient } = input;
  const ai = createAiServices();

  const base: AppContainer = {
    tripRepository: new DrizzleTripRepository(dbClient),
    destinationRepository: new DrizzleDestinationRepository(dbClient),
    spendEntryRepository: new DrizzleSpendEntryRepository(dbClient),
    tripFixedCostRepository: new DrizzleTripFixedCostRepository(dbClient),
    countryReferenceRepository: new DrizzleCountryReferenceRepository(dbClient),
    organizationRepository: new DrizzleOrganizationRepository(dbClient),
    userAccessRepository: new DrizzleUserAccessRepository(dbClient),
    inviteEmailService: createInviteEmailService(),
    itineraryParser: ai.itineraryParser,
    timelineInsightsService: ai.timelineInsightsService,
    aiCacheRepository: new DrizzleAiCacheRepository(dbClient),
    hashFn: sha256,
  };

  return {
    ...base,
    ...input.overrides,
  };
}
