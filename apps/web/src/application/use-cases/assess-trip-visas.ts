import type { CountryReferenceRepository } from '@/domain/country-reference/country-reference-repository';
import type { DestinationRepository } from '@/domain/destination/destination-repository';
import { timelineDateRange } from '@/domain/timeline/timeline';
import type { Result } from '@/domain/trip/types';
import { ok } from '@/domain/trip/types';
import type { Alpha3, TravellerProfile, VisaAssessment, VisaPurpose } from '@/domain/visa/types';
import { assessVisas } from '@/domain/visa/visa';
import type { VisaRuleRepository } from '@/domain/visa/visa-rule-repository';

export type AssessTripVisasRequest = {
  readonly tripId: string;
  readonly profile: TravellerProfile;
  readonly preferPurposes?: readonly VisaPurpose[];
};

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Assess a trip's visa coverage for a traveller. Read-only orchestration:
 * loads the trip's destinations, the country→alpha-3 mapping, zone memberships,
 * and the matching frozen rules, then delegates to the pure `assessVisas`
 * evaluator. No AI; deterministic.
 */
export async function assessTripVisas(
  destinationRepo: DestinationRepository,
  countryReferenceRepo: CountryReferenceRepository,
  visaRuleRepo: VisaRuleRepository,
  request: AssessTripVisasRequest,
): Promise<Result<VisaAssessment>> {
  const destinations = await destinationRepo.findByTrip(request.tripId);

  const window = timelineDateRange(destinations);
  if (window === null) {
    return ok({ coverages: [], unknownCountries: [] });
  }
  const travel = { start: toIsoDate(window.start), end: toIsoDate(window.end) };

  const references = await countryReferenceRepo.findAll();
  const alpha3ByCountry = new Map<string, Alpha3>(references.map((r) => [r.country, r.alpha3]));
  const toAlpha3 = (country: string): Alpha3 | null => alpha3ByCountry.get(country) ?? null;

  const memberships = await visaRuleRepo.findZoneMemberships();
  const zoneByAlpha3 = new Map<Alpha3, string>(memberships.map((m) => [m.alpha3, m.zoneCode]));
  const zoneOf = (alpha3: Alpha3): string | null => zoneByAlpha3.get(alpha3) ?? null;

  const destinationAlpha3s = [
    ...new Set(destinations.map((d) => toAlpha3(d.country)).filter((a): a is Alpha3 => a !== null)),
  ];
  const nationalities = request.profile.passports.map((p) => p.nationality);
  const rules = await visaRuleRepo.findByNationalitiesAndDestinations(
    nationalities,
    destinationAlpha3s,
  );

  return assessVisas(
    request.profile,
    destinations,
    rules,
    toAlpha3,
    zoneOf,
    travel,
    request.preferPurposes,
  );
}
