import {
  type CountryReferenceSummary,
  countryReferenceSummarySchema,
} from '@travel-planner/shared';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { apiGet } from '../api/client';
import { getAccessToken } from '../auth/get-access-token';

export function useCountries(): {
  loading: boolean;
  countries: CountryReferenceSummary[];
  error: string | null;
} {
  const [state, setState] = useState<{
    countries: CountryReferenceSummary[];
    error: string | null;
  }>({ countries: [], error: null });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    void (async () => {
      const access = await getAccessToken();
      const result = access.ok
        ? await apiGet('/api/v1/countries', z.array(countryReferenceSummarySchema), access.token)
        : null;
      if (!active) return;
      setState(
        result?.ok
          ? { countries: result.data, error: null }
          : {
              countries: [],
              error: result && !result.ok ? result.error.detail : 'Your session has expired.',
            },
      );
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);
  return { loading, ...state };
}
