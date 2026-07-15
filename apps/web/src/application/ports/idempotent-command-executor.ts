import type { CountryReferenceRepository } from '@/domain/country-reference/country-reference-repository';
import type { DestinationRepository } from '@/domain/destination/destination-repository';
import type { OrganizationRepository } from '@/domain/organization/organization-repository';
import type { SpendEntryRepository } from '@/domain/spending/spend-entry-repository';
import type { TripFixedCostRepository } from '@/domain/trip/fixed-cost-repository';
import type { TripRepository } from '@/domain/trip/trip-repository';

export type IdempotentCommandRepositories = {
  readonly tripRepository: TripRepository;
  readonly destinationRepository: DestinationRepository;
  readonly tripFixedCostRepository: TripFixedCostRepository;
  readonly organizationRepository: OrganizationRepository;
  readonly spendEntryRepository: SpendEntryRepository;
  readonly countryReferenceRepository: CountryReferenceRepository;
};

export type StoredHttpResponse = {
  readonly status: number;
  readonly body: unknown;
};

export type ExecuteIdempotentCommandInput = {
  readonly userId: string;
  readonly operation: string;
  readonly idempotencyKey: string;
  readonly requestHash: string;
};

export type IdempotentCommandResult =
  | {
      readonly kind: 'executed' | 'replayed';
      readonly response: StoredHttpResponse;
    }
  | { readonly kind: 'conflict' };

/**
 * Atomic boundary for retry-safe v1 mutations (ADR 064).
 *
 * Implementations claim the key, run the callback with transaction-scoped
 * repositories, and persist the callback's exact HTTP response in one commit.
 */
export interface IdempotentCommandExecutor {
  execute(
    input: ExecuteIdempotentCommandInput,
    command: (repositories: IdempotentCommandRepositories) => Promise<StoredHttpResponse>,
  ): Promise<IdempotentCommandResult>;
}
