import type { CityReferenceRepository } from '@/domain/country-reference/city-reference-repository';
import { estimateCityBudget } from '@/domain/country-reference/country-reference';
import type { CountryReferenceRepository } from '@/domain/country-reference/country-reference-repository';
import type { CityBudgetEstimate } from '@/domain/country-reference/types';
import type { ComfortLevel, Result } from '@/domain/trip/types';
import { err, ok } from '@/domain/trip/types';

export type GetCityCostEstimateInput = {
  country: string;
  city: string | null;
  days: number;
  comfortLevel: ComfortLevel;
};

export async function getCityCostEstimate(
  countryRefRepo: CountryReferenceRepository,
  cityRefRepo: CityReferenceRepository,
  input: GetCityCostEstimateInput,
): Promise<Result<CityBudgetEstimate>> {
  const countryRef = await countryRefRepo.findByCountry(input.country);
  if (!countryRef) return err(`No cost data for country: ${input.country}`);

  const cityRef = input.city ? await cityRefRepo.findByCity(input.city, input.country) : null;

  const estimate = estimateCityBudget(input.days, countryRef, input.comfortLevel, cityRef);
  return ok(estimate);
}
