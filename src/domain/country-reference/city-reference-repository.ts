import type { CityReference } from './types';

/**
 * Read-only repository for city-level cost data.
 *
 * City references provide cost multipliers relative to their country's
 * avgDailyCostPence. When no city data exists, callers fall back to
 * the country-level estimate.
 */
export interface CityReferenceRepository {
  findAll(): Promise<CityReference[]>;
  findByCity(city: string, country: string): Promise<CityReference | null>;
  findAllForCountry(country: string): Promise<CityReference[]>;
}
