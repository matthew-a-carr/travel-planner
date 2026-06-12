/**
 * Data hook for the trip detail screen (SPEC-012). Mirrors `useTrips`'
 * shape (plain React state, reload vs refresh, generation counter) for
 * SPEC-010's composite `GET /api/v1/trips/{id}`.
 *
 * `not_found` is a first-class state, not an error: the server collapses
 * deleted trips and revoked access into one 404 (SPEC-010 §8), and the
 * screen renders a neutral "trip not found" with a way back to the list.
 */

import { type TripDetail, tripDetailSchema } from '@travel-planner/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiGet } from '../api/client';
import { getAccessToken } from '../auth/get-access-token';

export type TripDetailState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; trip: TripDetail };

export type UseTripDetailResult = {
  state: TripDetailState;
  refreshing: boolean;
  reload: () => void;
  refresh: () => Promise<void>;
};

async function fetchTripDetail(tripId: string): Promise<TripDetailState> {
  const access = await getAccessToken();
  if (!access.ok) {
    return {
      status: 'error',
      message: 'Your session has expired. Please sign out and sign in again.',
    };
  }

  const result = await apiGet(
    `/api/v1/trips/${encodeURIComponent(tripId)}`,
    tripDetailSchema,
    access.token,
  );
  if (!result.ok) {
    if (result.error.code === 'not_found') return { status: 'not_found' };
    return { status: 'error', message: result.error.detail || 'Could not load this trip.' };
  }
  return { status: 'loaded', trip: result.data };
}

export function useTripDetail(tripId: string): UseTripDetailResult {
  const [state, setState] = useState<TripDetailState>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);

  const load = useCallback(
    async (showSpinner: boolean) => {
      const ticket = ++generation.current;
      if (showSpinner) setState({ status: 'loading' });
      const next = await fetchTripDetail(tripId);
      if (generation.current !== ticket) return; // superseded by a newer request
      setState(next);
    },
    [tripId],
  );

  useEffect(() => {
    void load(true);
    return () => {
      generation.current++; // invalidate in-flight work on unmount / id change
    };
  }, [load]);

  const reload = useCallback(() => {
    void load(true);
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(false);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return { state, refreshing, reload, refresh };
}
