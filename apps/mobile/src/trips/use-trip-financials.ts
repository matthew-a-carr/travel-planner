import { type TripFinancials, tripFinancialsSchema } from '@travel-planner/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from '../api/client';
import { getAccessToken } from '../auth/get-access-token';

export type TripFinancialsState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; financials: TripFinancials };

async function fetchFinancials(tripId: string): Promise<TripFinancialsState> {
  const access = await getAccessToken();
  if (!access.ok)
    return {
      status: 'error',
      message: 'Your session has expired. Please sign out and sign in again.',
    };
  const result = await apiGet(
    `/api/v1/trips/${encodeURIComponent(tripId)}/spend`,
    tripFinancialsSchema,
    access.token,
  );
  if (!result.ok) {
    if (result.error.code === 'not_found') return { status: 'not_found' };
    return { status: 'error', message: result.error.detail || 'Could not load spending.' };
  }
  return { status: 'loaded', financials: result.data };
}

export function useTripFinancials(tripId: string) {
  const [state, setState] = useState<TripFinancialsState>({ status: 'loading' });
  const generation = useRef(0);
  const reload = useCallback(() => {
    const ticket = ++generation.current;
    setState({ status: 'loading' });
    void fetchFinancials(tripId).then((next) => {
      if (generation.current === ticket) setState(next);
    });
  }, [tripId]);
  useEffect(() => {
    reload();
    return () => {
      generation.current++;
    };
  }, [reload]);
  return { state, reload };
}
