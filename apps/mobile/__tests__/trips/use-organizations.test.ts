const mockGetAccessToken = jest.fn();

jest.mock('../../src/auth/get-access-token', () => ({
  getAccessToken: () => mockGetAccessToken(),
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useOrganizations } from '../../src/trips/use-organizations';

const ORGANIZATION = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Family',
  role: 'owner',
};

function successEnvelope(data: unknown): Response {
  return new Response(
    JSON.stringify({
      data,
      request: { method: 'GET', path: '/api/v1/organizations', path_params: {}, query_params: {} },
      asof: '2026-07-11T10:00:00.000Z',
      version: '1.2.0',
    }),
    { status: 200 },
  );
}

function errorEnvelope(detail: string): Response {
  return new Response(
    JSON.stringify({
      error: {
        type: 'https://travel-planner.app/errors/internal',
        title: 'Error',
        status: 500,
        detail,
        instance: '/api/v1/organizations',
        code: 'internal',
      },
      request: { method: 'GET', path: '/api/v1/organizations', path_params: {}, query_params: {} },
      asof: '2026-07-11T10:00:00.000Z',
      version: '1.2.0',
    }),
    { status: 500 },
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

describe('useOrganizations', () => {
  it('loads organizations through the authenticated API client', async () => {
    fetchSpy.mockResolvedValueOnce(successEnvelope([ORGANIZATION]));

    const { result } = renderHook(() => useOrganizations());

    await waitFor(() => expect(result.current.state.status).toBe('loaded'));
    expect(result.current.state).toEqual({ status: 'loaded', organizations: [ORGANIZATION] });
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt-token');
  });

  it('surfaces API failures and reloads', async () => {
    fetchSpy.mockResolvedValueOnce(errorEnvelope('Organizations unavailable.'));
    const { result } = renderHook(() => useOrganizations());
    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(result.current.state).toEqual({
      status: 'error',
      message: 'Organizations unavailable.',
    });

    fetchSpy.mockResolvedValueOnce(successEnvelope([ORGANIZATION]));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.state.status).toBe('loaded'));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('does not call the API when the session cannot be refreshed', async () => {
    mockGetAccessToken.mockResolvedValue({ ok: false, reason: 'refresh_failed' });

    const { result } = renderHook(() => useOrganizations());

    await waitFor(() => expect(result.current.state.status).toBe('error'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
