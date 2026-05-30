/**
 * get-access-token.ts tests. Mocks `expo-secure-store` for the
 * keychain layer and `globalThis.fetch` for the /refresh call.
 *
 * Single-flight invariant matters: two concurrent callers facing an
 * expired access token must trigger exactly ONE /refresh call (per
 * SPEC-007 §3 AC#13 + §8 reuse-detection-race rationale).
 */

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __mockStore: store,
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

import * as SecureStore from 'expo-secure-store';
import { getAccessToken } from '../../src/auth/get-access-token';
import { storeTokens } from '../../src/auth/keychain';

type SecureStoreMock = typeof SecureStore & {
  __mockStore: Map<string, string>;
  setItemAsync: jest.Mock;
  deleteItemAsync: jest.Mock;
  getItemAsync: jest.Mock;
};

const mockedStore = SecureStore as SecureStoreMock;

function mockFetchSequence(...responses: (Response | Error)[]): jest.SpyInstance {
  const spy = jest.spyOn(globalThis, 'fetch');
  for (const response of responses) {
    if (response instanceof Error) {
      spy.mockRejectedValueOnce(response);
    } else {
      spy.mockResolvedValueOnce(response);
    }
  }
  return spy;
}

// SPEC-007 / ADR 056: every /api/v1/* 2xx body is the success envelope
// { data, request, asof, version }. apiPost unwraps `.data`.
function successEnvelope<T>(data: T): Record<string, unknown> {
  return {
    data,
    request: {
      method: 'POST',
      path: '/api/v1/auth/mobile/refresh',
      path_params: {},
      query_params: {},
    },
    asof: '2026-05-21T18:00:00.000Z',
    version: '1.1.0',
  };
}

function freshRefreshResponse(suffix: string): Response {
  return new Response(
    JSON.stringify(
      successEnvelope({
        access_token: `new-access-${suffix}`,
        refresh_token: `new-refresh-${suffix}`,
        access_expires_at: '2030-01-01T00:00:00.000Z',
      }),
    ),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

beforeEach(() => {
  mockedStore.__mockStore.clear();
  mockedStore.setItemAsync.mockClear();
  mockedStore.deleteItemAsync.mockClear();
  mockedStore.getItemAsync.mockClear();
  jest.useRealTimers();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('getAccessToken', () => {
  it('returns no_tokens when keychain is empty', async () => {
    const result = await getAccessToken();
    expect(result).toEqual({ ok: false, reason: 'no_tokens' });
  });

  it('returns the stored access token when it has more than 60s of life', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-22T10:00:00.000Z'));

    await storeTokens({
      access_token: 'still-valid-access',
      refresh_token: 'still-valid-refresh',
      access_expires_at: '2026-05-22T10:14:30.000Z', // 14m 30s of life, > 60s buffer
    });

    const fetchSpy = jest.spyOn(globalThis, 'fetch');

    const result = await getAccessToken();

    expect(result).toEqual({ ok: true, token: 'still-valid-access' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refreshes when the access token has less than 60s of life and persists the new pair', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-22T10:14:30.000Z'));

    await storeTokens({
      access_token: 'expiring-soon-access',
      refresh_token: 'good-refresh',
      access_expires_at: '2026-05-22T10:15:00.000Z', // 30s of life, < 60s buffer
    });

    mockFetchSequence(freshRefreshResponse('A'));

    const result = await getAccessToken();

    expect(result).toEqual({ ok: true, token: 'new-access-A' });
    expect(mockedStore.__mockStore.get('travel_planner.access_token')).toBe('new-access-A');
    expect(mockedStore.__mockStore.get('travel_planner.refresh_token')).toBe('new-refresh-A');
  });

  it('returns refresh_failed and clears keychain when /refresh returns refresh_revoked', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-22T11:00:00.000Z'));

    await storeTokens({
      access_token: 'old-access',
      refresh_token: 'revoked-refresh',
      access_expires_at: '2026-05-22T10:00:00.000Z', // already expired
    });

    mockFetchSequence(
      new Response(
        JSON.stringify({
          error: {
            type: 'https://travel-planner.app/errors/refresh_revoked',
            title: 'Unauthorized',
            status: 401,
            detail: 'Refresh token was revoked.',
            instance: '/api/v1/auth/mobile/refresh',
            code: 'refresh_revoked',
          },
          request: {
            method: 'POST',
            path: '/api/v1/auth/mobile/refresh',
            path_params: {},
            query_params: {},
          },
          asof: '2026-05-21T18:00:00.000Z',
          version: '1.1.0',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const result = await getAccessToken();

    expect(result).toEqual({ ok: false, reason: 'refresh_failed' });
    // Keychain wiped — no leftover tokens for the next call.
    expect(mockedStore.__mockStore.size).toBe(0);
  });

  it('single-flight: concurrent callers share one /refresh and one token', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-22T10:14:30.000Z'));

    await storeTokens({
      access_token: 'expiring',
      refresh_token: 'good-refresh',
      access_expires_at: '2026-05-22T10:15:00.000Z',
    });

    // Single fetch mock — if get-access-token calls /refresh twice,
    // the second call returns undefined and the test fails.
    const fetchSpy = mockFetchSequence(freshRefreshResponse('SHARED'));

    const [a, b, c] = await Promise.all([getAccessToken(), getAccessToken(), getAccessToken()]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(a).toEqual({ ok: true, token: 'new-access-SHARED' });
    expect(b).toEqual({ ok: true, token: 'new-access-SHARED' });
    expect(c).toEqual({ ok: true, token: 'new-access-SHARED' });
  });

  it('after a refresh completes, the next call starts a fresh single-flight window', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-22T10:14:30.000Z'));

    await storeTokens({
      access_token: 'expiring-1',
      refresh_token: 'good-refresh',
      access_expires_at: '2026-05-22T10:15:00.000Z',
    });

    // First call refreshes successfully → new tokens persisted with a
    // fresh access_expires_at far in the future. Second call (immediate)
    // sees the still-valid new token and does NOT trigger another refresh.
    const fetchSpy = mockFetchSequence(freshRefreshResponse('FIRST'));

    const first = await getAccessToken();
    expect(first).toEqual({ ok: true, token: 'new-access-FIRST' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Second call — still valid; no additional fetch.
    const second = await getAccessToken();
    expect(second).toEqual({ ok: true, token: 'new-access-FIRST' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
