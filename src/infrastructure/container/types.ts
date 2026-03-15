import type { InviteEmailService } from '@/application/ports/invite-email-service';
import type { CityReferenceRepository } from '@/domain/country-reference/city-reference-repository';
import type { CountryReferenceRepository } from '@/domain/country-reference/country-reference-repository';
import type { DestinationRepository } from '@/domain/destination/destination-repository';
import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import type { SpendEntryRepository } from '@/domain/spending/spend-entry-repository';
import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';
import type { UserAccessRepository } from '@/domain/user-access/user-access-repository';

export type AppContainer = {
  readonly tripRepository: TripRepository;
  readonly destinationRepository: DestinationRepository;
  readonly spendEntryRepository: SpendEntryRepository;
  readonly tripFixedCostRepository: TripFixedCostRepository;
  readonly countryReferenceRepository: CountryReferenceRepository;
  readonly cityReferenceRepository: CityReferenceRepository;
  readonly organizationRepository: OrganizationRepository;
  readonly userAccessRepository: UserAccessRepository;
  readonly inviteEmailService: InviteEmailService;
};
