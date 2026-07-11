import { type OrganizationSummary, organizationSummarySchema } from '@travel-planner/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { apiGet } from '../api/client';
import { getAccessToken } from '../auth/get-access-token';

export type OrganizationsState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'loaded'; readonly organizations: OrganizationSummary[] };

const organizationsSchema = z.array(organizationSummarySchema);

async function fetchOrganizations(): Promise<OrganizationsState> {
  const access = await getAccessToken();
  if (!access.ok) {
    return { status: 'error', message: 'Your session has expired. Please sign in again.' };
  }
  const result = await apiGet('/api/v1/organizations', organizationsSchema, access.token);
  return result.ok
    ? { status: 'loaded', organizations: result.data }
    : { status: 'error', message: result.error.detail || 'Could not load organizations.' };
}

export function useOrganizations(): {
  readonly state: OrganizationsState;
  readonly reload: () => void;
} {
  const [state, setState] = useState<OrganizationsState>({ status: 'loading' });
  const generation = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++generation.current;
    setState({ status: 'loading' });
    const next = await fetchOrganizations();
    if (generation.current === ticket) setState(next);
  }, []);

  useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [load]);

  return { state, reload: () => void load() };
}
