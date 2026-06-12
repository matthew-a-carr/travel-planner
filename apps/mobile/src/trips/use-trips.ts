/**
 * Data hook for the trips list (SPEC-011). Plain React state — no data
 * library (EPIC-002 §10). Fetches `GET /api/v1/trips` with a bearer from
 * `getAccessToken()`; the apiClient unwraps the envelope and validates
 * against the shared schema.
 *
 * Two refetch paths with different UX:
 *  - `reload()`  — full-screen spinner (initial load / error retry).
 *  - `refresh()` — pull-to-refresh; keeps the stale list visible and
 *    resolves when done so RefreshControl can stop spinning.
 *
 * A generation counter guards against out-of-order responses (a slow
 * reload landing after a newer refresh).
 */

import { type TripSummary, tripSummarySchema } from '@travel-planner/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { apiGet } from '../api/client';
import { getAccessToken } from '../auth/get-access-token';

export type TripsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; trips: TripSummary[] };

export type UseTripsResult = {
  state: TripsState;
  refreshing: boolean;
  reload: () => void;
  refresh: () => Promise<void>;
};

const tripsListSchema = z.array(tripSummarySchema);

async function fetchTrips(): Promise<TripsState> {
  const access = await getAccessToken();
  if (!access.ok) {
    return {
      status: 'error',
      message: 'Your session has expired. Please sign out and sign in again.',
    };
  }

  const result = await apiGet('/api/v1/trips', tripsListSchema, access.token);
  if (!result.ok) {
    return { status: 'error', message: result.error.detail || 'Could not load your trips.' };
  }
  return { status: 'loaded', trips: result.data };
}

export function useTrips(): UseTripsResult {
  const [state, setState] = useState<TripsState>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const generation = useRef(0);

  const load = useCallback(async (showSpinner: boolean) => {
    const ticket = ++generation.current;
    if (showSpinner) setState({ status: 'loading' });
    const next = await fetchTrips();
    if (generation.current !== ticket) return; // a newer request superseded this one
    setState(next);
  }, []);

  useEffect(() => {
    void load(true);
    return () => {
      generation.current++; // invalidate in-flight work on unmount
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
