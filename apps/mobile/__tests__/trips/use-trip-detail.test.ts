/**
 * useTripDetail hook tests — same harness as use-trips: mocked
 * getAccessToken, fetch spy with canned envelopes (apiGet's real
 * envelope-parsing runs).
 */

const mockGetAccessToken = jest.fn();

jest.mock('../../src/auth/get-access-token', () => ({
  getAccessToken: () => mockGetAccessToken(),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { useTripDetail } from '../../src/trips/use-trip-detail';

const DETAIL = {
  id: 'trip-1',
  name: 'Japan 2026',
  status: 'planning',
  totalBudget: { amountPence: 500_000, currency: 'GBP' },
  startDate: '2026-09-01',
  endDate: '2026-09-21',
  organizationId: 'org-1',
  updatedAt: '2026-05-30T12:34:56.789Z',
  destinations: [
    {
      id: 'd1',
      name: 'Tokyo',
      country: 'Japan',
      city: 'Tokyo',
      startDate: '2026-09-01',
      endDate: '2026-09-10',
      estimatedBudget: { amountPence: 250_000, currency: 'GBP' },
      comfortLevel: 'mid',
      sortOrder: 0,
      spent: { amountPence: 12_345, currency: 'GBP' },
    },
  ],
  fixedCosts: [
    {
      id: 'f1',
      label: 'Flights',
      amount: { amountPence: 120_000, currency: 'GBP' },
      category: 'transport',
      date: '2026-08-15',
      sortOrder: 0,
    },
  ],
  spend: {
    totalBudget: { amountPence: 500_000, currency: 'GBP' },
    fixedCosts: { amountPence: 120_000, currency: 'GBP' },
    allocated: { amountPence: 250_000, currency: 'GBP' },
    available: { amountPence: 130_000, currency: 'GBP' },
    spent: { amountPence: 12_345, currency: 'GBP' },
    isOverAllocated: false,
  },
};

function envelope(body: Record<string, unknown>, status = 200): Response {
  return new Response(
    JSON.stringify({
      ...body,
      request: {
        method: 'GET',
        path: '/api/v1/trips/trip-1',
        path_params: { id: 'trip-1' },
        query_params: {},
      },
      asof: '2026-06-11T10:00:00.000Z',
      version: '1.2.0',
    }),
    { status },
  );
}

function errorBody(status: number, code: string, detail: string) {
  return {
    error: {
      type: `https://travel-planner.app/errors/${code}`,
      title: 'Error',
      status,
      detail,
      instance: '/api/v1/trips/trip-1',
      code,
    },
  };
}

let fetchSpy: jest.SpyInstance;

beforeEach(() => {
  fetchSpy = jest.spyOn(globalThis, 'fetch');
  mockGetAccessToken.mockResolvedValue({ ok: true, token: 'jwt-token' });
});

afterEach(() => {
  jest.restoreAllMocks();
  mockGetAccessToken.mockReset();
});

describe('useTripDetail', () => {
  it('loads the composite detail and requests the right path with the bearer', async () => {
    fetchSpy.mockResolvedValueOnce(envelope({ data: DETAIL }));

    const { result } = renderHook(() => useTripDetail('trip-1'));

    expect(result.current.state.status).toBe('loading');
    await waitFor(() => expect(result.current.state.status).toBe('loaded'));
    expect(result.current.state).toEqual({ status: 'loaded', trip: DETAIL });

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/api/v1/trips/trip-1');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-token');
  });

  it('maps a 404 not_found to the dedicated not_found state', async () => {
    fetchSpy.mockResolvedValueOnce(envelope(errorBody(404, 'not_found', 'Trip not found.'), 404));

    const { result } = renderHook(() => useTripDetail('trip-1'));

    await waitFor(() => expect(result.current.state.status).toBe('not_found'));
  });

  it('maps other API errors to the error state with the server detail', async () => {
    fetchSpy.mockResolvedValueOnce(envelope(errorBody(500, 'internal', 'Down.'), 500));

    const { result } = renderHook(() => useTripDetail('trip-1'));

    await waitFor(() =>
      expect(result.current.state).toEqual({ status: 'error', message: 'Down.' }),
    );
  });

  it('maps a token failure to the error state without calling the API', async () => {
    mockGetAccessToken.mockResolvedValue({ ok: false, reason: 'no_tokens' });

    const { result } = renderHook(() => useTripDetail('trip-1'));

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reload() after an error refetches into loaded', async () => {
    fetchSpy.mockResolvedValueOnce(envelope(errorBody(500, 'internal', 'Down.'), 500));
    const { result } = renderHook(() => useTripDetail('trip-1'));
    await waitFor(() => expect(result.current.state.status).toBe('error'));

    fetchSpy.mockResolvedValueOnce(envelope({ data: DETAIL }));
    result.current.reload();

    await waitFor(() => expect(result.current.state.status).toBe('loaded'));
  });

  it('refresh() keeps the loaded detail visible while refetching', async () => {
    fetchSpy.mockResolvedValueOnce(envelope({ data: DETAIL }));
    const { result } = renderHook(() => useTripDetail('trip-1'));
    await waitFor(() => expect(result.current.state.status).toBe('loaded'));

    let release: (response: Response) => void = () => {};
    fetchSpy.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
    );

    const refreshPromise = result.current.refresh();
    await waitFor(() => expect(result.current.refreshing).toBe(true));
    expect(result.current.state.status).toBe('loaded');

    release(envelope({ data: { ...DETAIL, name: 'Japan 2026 (updated)' } }));
    await refreshPromise;

    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(result.current.state).toMatchObject({
      status: 'loaded',
      trip: { name: 'Japan 2026 (updated)' },
    });
  });
});
