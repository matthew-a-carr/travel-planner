import type { Alpha3, VisaRule } from './types';

/** A country's membership of a visa zone (e.g. Schengen). */
export type VisaZoneMembership = {
  readonly zoneCode: string;
  readonly alpha3: Alpha3;
};

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

  /** All zone memberships (alpha-3 → zone code), for grouping shared allowances. */
  findZoneMemberships(): Promise<VisaZoneMembership[]>;
}
