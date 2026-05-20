import { createAiServices } from '@/infrastructure/ai/create-ai-services';
import { DrizzleAiCacheRepository } from '@/infrastructure/ai/drizzle-ai-cache-repository';
import { sha256 } from '@/infrastructure/ai/hash';
import { FetchGoogleOAuthClient } from '@/infrastructure/auth/google-oauth-client';
import { WebCryptoMobileAuthCrypto } from '@/infrastructure/auth/mobile-auth-crypto';
import type { Db } from '@/infrastructure/db/client';
import { DrizzleAuthRateLimitRepository } from '@/infrastructure/db/repositories/drizzle-auth-rate-limit-repository';
import { DrizzleChatMessageRepository } from '@/infrastructure/db/repositories/drizzle-chat-message-repository';
import { DrizzleCountryReferenceRepository } from '@/infrastructure/db/repositories/drizzle-country-reference-repository';
import { DrizzleDestinationRepository } from '@/infrastructure/db/repositories/drizzle-destination-repository';
import { DrizzleMobileAuthExchangeCodeRepository } from '@/infrastructure/db/repositories/drizzle-mobile-auth-exchange-code-repository';
import { DrizzleMobileAuthStateRepository } from '@/infrastructure/db/repositories/drizzle-mobile-auth-state-repository';
import { DrizzleOrganizationRepository } from '@/infrastructure/db/repositories/drizzle-organization-repository';
import { DrizzleRefreshTokenRepository } from '@/infrastructure/db/repositories/drizzle-refresh-token-repository';
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

  const tripRepository = new DrizzleTripRepository(dbClient);
  const destinationRepository = new DrizzleDestinationRepository(dbClient);
  const spendEntryRepository = new DrizzleSpendEntryRepository(dbClient);
  const tripFixedCostRepository = new DrizzleTripFixedCostRepository(dbClient);

  const ai = createAiServices({
    tripRepository,
    destinationRepository,
    spendEntryRepository,
    tripFixedCostRepository,
  });

  const base: AppContainer = {
    tripRepository,
    destinationRepository,
    spendEntryRepository,
    tripFixedCostRepository,
    countryReferenceRepository: new DrizzleCountryReferenceRepository(dbClient),
    organizationRepository: new DrizzleOrganizationRepository(dbClient),
    userAccessRepository: new DrizzleUserAccessRepository(dbClient),
    inviteEmailService: createInviteEmailService(),
    itineraryParser: ai.itineraryParser,
    timelineInsightsService: ai.timelineInsightsService,
    tripNarrativeService: ai.tripNarrativeService,
    aiCacheRepository: new DrizzleAiCacheRepository(dbClient),
    hashFn: sha256,
    chatMessageRepository: new DrizzleChatMessageRepository(dbClient),
    chatAssistant: ai.chatAssistant,
    mobileAuthStateRepository: new DrizzleMobileAuthStateRepository(dbClient),
    mobileAuthExchangeCodeRepository: new DrizzleMobileAuthExchangeCodeRepository(dbClient),
    refreshTokenRepository: new DrizzleRefreshTokenRepository(dbClient),
    authRateLimitRepository: new DrizzleAuthRateLimitRepository(dbClient),
    mobileAuthCrypto: new WebCryptoMobileAuthCrypto(),
    googleOAuthClient: new FetchGoogleOAuthClient(
      process.env.AUTH_GOOGLE_ID ?? '',
      process.env.AUTH_GOOGLE_SECRET ?? '',
    ),
  };

  return {
    ...base,
    ...input.overrides,
  };
}
