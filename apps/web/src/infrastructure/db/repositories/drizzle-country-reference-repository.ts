import { eq } from 'drizzle-orm';
import type { CountryReferenceRepository } from '@/domain/country-reference/country-reference-repository';
import type { CountryReference } from '@/domain/country-reference/types';
import type { Currency } from '@/domain/trip/types';
import type { Db } from '../client';
import { countryReferenceData } from '../schema';

function toCountryReference(row: typeof countryReferenceData.$inferSelect): CountryReference {
  return {
    country: row.country,
    alpha2: row.alpha2,
    alpha3: row.alpha3,
    region: row.region,
    subregion: row.subregion,
    avgDailyCostPence: row.avgDailyCostPence,
    currency: row.currency as Currency,
    source: row.source as 'manual' | 'estimated',
  };
}

export class DrizzleCountryReferenceRepository implements CountryReferenceRepository {
  constructor(private readonly db: Db) {}

  async findAll(): Promise<CountryReference[]> {
    const rows = await this.db
      .select()
      .from(countryReferenceData)
      .orderBy(countryReferenceData.country);
    return rows.map(toCountryReference);
  }

  async findByCountry(country: string): Promise<CountryReference | null> {
    const rows = await this.db
      .select()
      .from(countryReferenceData)
      .where(eq(countryReferenceData.country, country));
    return rows[0] ? toCountryReference(rows[0]) : null;
  }
}
