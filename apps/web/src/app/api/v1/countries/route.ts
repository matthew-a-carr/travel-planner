import type { CountryReferenceSummary } from '@travel-planner/shared';
import { getCountryReferences } from '@/application/use-cases/get-country-references';
import { suggestBudget } from '@/domain/country-reference/country-reference';
import type { CountryReference } from '@/domain/country-reference/types';
import { getAppContainer } from '@/infrastructure/container';
import { requireAuth } from '../_lib/auth';
import { respondWithError } from '../_lib/errors';
import { respondWithData } from '../_lib/respond';

function toSummary(reference: CountryReference): CountryReferenceSummary {
  return {
    country: reference.country,
    alpha2: reference.alpha2,
    alpha3: reference.alpha3,
    region: reference.region,
    subregion: reference.subregion,
    currency: reference.currency,
    suggestedDailyBudget: {
      budget: suggestBudget(1, reference, 'budget'),
      mid: suggestBudget(1, reference, 'mid'),
      luxury: suggestBudget(1, reference, 'luxury'),
    },
  };
}

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await requireAuth(request);
    if (!session.ok) return session.response;
    const references = await getCountryReferences(getAppContainer().countryReferenceRepository);
    return respondWithData(request, references.map(toSummary));
  } catch (error) {
    console.error('[api/v1/countries] unexpected error', error);
    return respondWithError(request, 'internal', { detail: 'An unexpected error occurred.' });
  }
}
