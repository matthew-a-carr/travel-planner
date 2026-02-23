import type { CountryReference } from './types';

/**
 * Read-only repository for country reference data.
 *
 * The domain defines this interface; infrastructure provides the implementation.
 * Future implementations may fetch from external APIs (Numbeo, Budget Your Trip)
 * without requiring changes to the domain or application layers.
 */
export interface CountryReferenceRepository {
  findAll(): Promise<CountryReference[]>;
  findByCountry(country: string): Promise<CountryReference | null>;
}
