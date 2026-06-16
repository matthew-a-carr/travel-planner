import type { AiCacheRepository } from '@/application/ports/ai-cache-repository';
import type { ChatAssistantService } from '@/application/ports/chat-assistant';
import type { ChatMessageRepository } from '@/application/ports/chat-message-repository';
import type { InviteEmailService } from '@/application/ports/invite-email-service';
import type { ItineraryParser } from '@/application/ports/itinerary-parser';
import type { TimelineInsightsService } from '@/application/ports/timeline-insights-service';
import type { TripNarrativeService } from '@/application/ports/trip-narrative-service';
import type { AuthRateLimitRepository } from '@/domain/auth/auth-rate-limit-repository';
import type { GoogleOAuthClient } from '@/domain/auth/google-oauth-client';
import type { MobileAuthCrypto } from '@/domain/auth/mobile-auth-crypto';
import type { MobileAuthExchangeCodeRepository } from '@/domain/auth/mobile-auth-exchange-code-repository';
import type { MobileAuthStateRepository } from '@/domain/auth/mobile-auth-state-repository';
import type { RefreshTokenRepository } from '@/domain/auth/refresh-token-repository';
import type { CountryReferenceRepository } from '@/domain/country-reference/country-reference-repository';
import type { DestinationRepository } from '@/domain/destination/destination-repository';
import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import type { SpendEntryRepository } from '@/domain/spending/spend-entry-repository';
import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { UserAccessRepository } from '@/domain/user-access/user-access-repository';
import type { UserProfileRepository } from '@/domain/user-profile/user-profile-repository';

export type AppContainer = {
  readonly tripRepository: TripRepository;
  readonly destinationRepository: DestinationRepository;
  readonly spendEntryRepository: SpendEntryRepository;
  readonly tripFixedCostRepository: TripFixedCostRepository;
  readonly countryReferenceRepository: CountryReferenceRepository;
  readonly organizationRepository: OrganizationRepository;
  readonly userAccessRepository: UserAccessRepository;
  readonly userProfileRepository: UserProfileRepository;
  readonly inviteEmailService: InviteEmailService;
  readonly itineraryParser: ItineraryParser;
  readonly timelineInsightsService: TimelineInsightsService;
  readonly tripNarrativeService: TripNarrativeService;
  readonly aiCacheRepository: AiCacheRepository;
  readonly hashFn: (input: string) => string;
  readonly chatMessageRepository: ChatMessageRepository;
  readonly chatAssistant: ChatAssistantService;

  // Mobile auth (SPEC-004 / ADR 051).
  readonly mobileAuthStateRepository: MobileAuthStateRepository;
  readonly mobileAuthExchangeCodeRepository: MobileAuthExchangeCodeRepository;
  readonly refreshTokenRepository: RefreshTokenRepository;
  readonly authRateLimitRepository: AuthRateLimitRepository;
  readonly mobileAuthCrypto: MobileAuthCrypto;
  readonly googleOAuthClient: GoogleOAuthClient;
};
