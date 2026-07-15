const mockGetAccessToken = jest.fn();

jest.mock('../../src/auth/get-access-token', () => ({
  getAccessToken: () => mockGetAccessToken(),
}));

import { renderHook, waitFor } from '@testing-library/react-native';
import { useTripFinancials } from '../../src/trips/use-trip-financials';

const FINANCIALS = {
  entries: [],
  categoryTotals: [{ category: 'food', amountPence: 2500 }],
  burndown: null,
  alerts: [],
};

function envelope(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({
      data,
      request: {
        method: 'GET',
        path: '/api/v1/trips/trip-1/spend',
        path_params: { id: 'trip-1' },
        query_params: {},
      },
      asof: '2026-07-11T12:00:00.000Z',
      version: '1.3.0',
    }),
    { status },
  );
}

function notFoundEnvelope(): Response {
  return new Response(
    JSON.stringify({
      error: {
        type: 'https://travel-planner.app/errors/not_found',
        title: 'Not found',
        status: 404,
        detail: 'Trip not found.',
        instance: '/api/v1/trips/trip-1/spend',
        code: 'not_found',
      },
      request: {
        method: 'GET',
        path: '/api/v1/trips/trip-1/spend',
        path_params: { id: 'trip-1' },
        query_params: {},
      },
      asof: '2026-07-11T12:00:00.000Z',
      version: '1.3.0',
    }),
    { status: 404 },
  );
}

afterEach(() => jest.restoreAllMocks());

describe('useTripFinancials', () => {
  it('loads financials with a bearer token', async () => {
    mockGetAccessToken.mockResolvedValue({ ok: true, token: 'jwt' });
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(envelope(FINANCIALS));

    const { result } = renderHook(() => useTripFinancials('trip-1'));
    await waitFor(() => expect(result.current.state.status).toBe('loaded'));

    expect(result.current.state).toEqual({ status: 'loaded', financials: FINANCIALS });
    expect(fetchSpy.mock.calls[0]?.[0]).toContain('/api/v1/trips/trip-1/spend');
  });

  it('maps a neutral not-found response', async () => {
    mockGetAccessToken.mockResolvedValueOnce({ ok: true, token: 'jwt' });
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(notFoundEnvelope());
    const missing = renderHook(() => useTripFinancials('trip-1'));
    await waitFor(() => expect(missing.result.current.state.status).toBe('not_found'));
  });

  it('fails before the request when the token is unavailable', async () => {
    mockGetAccessToken.mockResolvedValueOnce({ ok: false, reason: 'missing' });
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const missingToken = renderHook(() => useTripFinancials('trip-1'));
    await waitFor(() => expect(missingToken.result.current.state.status).toBe('error'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
