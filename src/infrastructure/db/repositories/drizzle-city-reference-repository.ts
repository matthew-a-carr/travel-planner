import { and, eq } from 'drizzle-orm';
import type { CityReferenceRepository } from '@/domain/country-reference/city-reference-repository';
import type { CityReference } from '@/domain/country-reference/types';
import type { Db } from '../client';
import { cityReferenceData } from '../schema';

function toCityReference(row: typeof cityReferenceData.$inferSelect): CityReference {
  return {
    city: row.city,
    country: row.country,
    costMultiplier: row.costMultiplier,
    source: row.source as 'manual' | 'estimated',
  };
}

export class DrizzleCityReferenceRepository implements CityReferenceRepository {
  constructor(private readonly db: Db) {}

  async findAll(): Promise<CityReference[]> {
    const rows = await this.db
      .select()
      .from(cityReferenceData)
      .orderBy(cityReferenceData.country, cityReferenceData.city);
    return rows.map(toCityReference);
  }

  async findByCity(city: string, country: string): Promise<CityReference | null> {
    const rows = await this.db
      .select()
      .from(cityReferenceData)
      .where(and(eq(cityReferenceData.city, city), eq(cityReferenceData.country, country)));
    return rows[0] ? toCityReference(rows[0]) : null;
  }

  async findAllForCountry(country: string): Promise<CityReference[]> {
    const rows = await this.db
      .select()
      .from(cityReferenceData)
      .where(eq(cityReferenceData.country, country))
      .orderBy(cityReferenceData.city);
    return rows.map(toCityReference);
  }
}
