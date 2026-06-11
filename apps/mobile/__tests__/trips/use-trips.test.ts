/**
 * useTrips hook tests. getAccessToken is mocked (Keychain/refresh logic
 * has its own suite); the network is the standard fetch spy with canned
 * envelope bodies, so apiGet's real envelope-parsing path runs.
 */

const mockGetAccessToken = jest.fn();

jest.mock('../../src/auth/get-access-token', () => ({
  getAccessToken: () => mockGetAccessToken(),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { useTrips } from '../../src/trips/use-trips';

const TRIP = {
  id: 'trip-1',
  name: 'Japan 2026',
  status: 'planning',
  totalBudget: { amountPence: 500_000, currency: 'GBP' },
  startDate: '2026-09-01',
  endDate: '2026-09-21',
  organizationId: 'org-1',
  updatedAt: '2026-05-30T12:34:56.789Z',
};

function successEnvelope(data: unknown): Response {
  return new Response(
    JSON.stringify({
      data,
      request: { method: 'GET', path: '/api/v1/trips', path_params: {}, query_params: {} },
      asof: '2026-06-11T10:00:00.000Z',
      version: '1.2.0',
    }),
    { status: 200 },
  );
}

function errorEnvelope(status: number, code: string, detail: string): Response {
  return new Response(
    JSON.stringify({
      error: {
        type: `https://travel-planner.app/errors/${code}`,
        title: 'Error',
        status,
        detail,
        instance: '/api/v1/trips',
        code,
      },
      request: { method: 'GET', path: '/api/v1/trips', path_params: {}, query_params: {} },
      asof: '2026-06-11T10:00:00.000Z',
      version: '1.2.0',
    }),
    { status },
  );
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

describe('useTrips', () => {
  it('starts loading then lands loaded with the fetched trips', async () => {
    fetchSpy.mockResolvedValueOnce(successEnvelope([TRIP]));

    const { result } = renderHook(() => useTrips());

    expect(result.current.state.status).toBe('loading');
    await waitFor(() => expect(result.current.state.status).toBe('loaded'));
    expect(result.current.state).toEqual({ status: 'loaded', trips: [TRIP] });

    // Bearer flowed through to the request.
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-token');
  });

  it('lands loaded with an empty list', async () => {
    fetchSpy.mockResolvedValueOnce(successEnvelope([]));

    const { result } = renderHook(() => useTrips());

    await waitFor(() => expect(result.current.state.status).toBe('loaded'));
    expect(result.current.state).toEqual({ status: 'loaded', trips: [] });
  });

  it('maps an API error to the error state with the server detail', async () => {
    fetchSpy.mockResolvedValueOnce(errorEnvelope(500, 'internal', 'Something broke.'));

    const { result } = renderHook(() => useTrips());

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state).toEqual({ status: 'error', message: 'Something broke.' });
  });

  it('maps a token failure to the error state without calling the API', async () => {
    mockGetAccessToken.mockResolvedValue({ ok: false, reason: 'refresh_failed' });

    const { result } = renderHook(() => useTrips());

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('reload() re-enters loading and refetches', async () => {
    fetchSpy.mockResolvedValueOnce(errorEnvelope(500, 'internal', 'Down.'));
    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.state.status).toBe('error'));

    fetchSpy.mockResolvedValueOnce(successEnvelope([TRIP]));
    result.current.reload();

    await waitFor(() => expect(result.current.state.status).toBe('loaded'));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('refresh() keeps the loaded list visible while refetching, then applies the result', async () => {
    fetchSpy.mockResolvedValueOnce(successEnvelope([TRIP]));
    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.state.status).toBe('loaded'));

    let release: (response: Response) => void = () => {};
    fetchSpy.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
    );

    const refreshPromise = result.current.refresh();
    await waitFor(() => expect(result.current.refreshing).toBe(true));
    // Stale list still visible mid-refresh — no loading flash.
    expect(result.current.state.status).toBe('loaded');

    release(successEnvelope([]));
    await refreshPromise;

    await waitFor(() => expect(result.current.refreshing).toBe(false));
    expect(result.current.state).toEqual({ status: 'loaded', trips: [] });
  });
});
