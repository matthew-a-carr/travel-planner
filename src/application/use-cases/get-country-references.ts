import type { CountryReferenceRepository } from '@/domain/country-reference/country-reference-repository';
import type { CountryReference } from '@/domain/country-reference/types';

/**
 * Returns all country reference records, ordered alphabetically by country name.
 * Used to populate the budget suggestion engine in the Add Destination form.
 */
export async function getCountryReferences(
  repo: CountryReferenceRepository,
): Promise<CountryReference[]> {
  return repo.findAll();
}
