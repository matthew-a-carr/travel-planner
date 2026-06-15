import type { Alpha3, VisaRule } from './types';

/**
 * Read-only access to the frozen visa-rule reference data (seeded; see
 * SPEC-015). Implementations live in `infrastructure/db/repositories/`.
 */
export interface VisaRuleRepository {
  /** All rules for a single passport nationality (alpha-3). */
  findByNationality(nationality: Alpha3): Promise<VisaRule[]>;

  /** Rules for any of the given nationalities into any of the given destinations. */
  findByNationalitiesAndDestinations(
    nationalities: readonly Alpha3[],
    destinations: readonly Alpha3[],
  ): Promise<VisaRule[]>;
}
