/**
 * e2e-browser-leg.ts tests (SPEC-014). The substitute browser leg that the
 * E2E app build injects into runSignInFlow in place of
 * WebBrowser.openAuthSessionAsync. Network mocking via the same
 * `jest.spyOn(globalThis, 'fetch')` pattern as the api client tests.
 */

import * as WebBrowser from 'expo-web-browser';
import { e2eOpenAuthSession, resolveBrowserLeg } from '../../src/auth/e2e-browser-leg';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

function successEnvelope(redirectUrl: string, path: string): Record<string, unknown> {
  return {
    data: { redirect_url: redirectUrl },
    request: { method: 'POST', path, path_params: {}, query_params: {} },
    asof: '2026-06-13T12:00:00.000Z',
    version: '1.1.0',
  };
}

function errorEnvelope(code: string, status: number, path: string): Record<string, unknown> {
  return {
    error: {
      type: `https://travel-planner.app/errors/${code}`,
      title: 'Not found',
      status,
      detail: 'Not found.',
      instance: path,
      code,
    },
    request: { method: 'POST', path, path_params: {}, query_params: {} },
    asof: '2026-06-13T12:00:00.000Z',
    version: '1.1.0',
  };
}

const AUTHORISE_URL = 'https://accounts.google.test/o/oauth2/v2/auth?state=the-live-state&foo=bar';

afterEach(() => jest.restoreAllMocks());

describe('resolveBrowserLeg', () => {
  it('returns the e2e substitute when the flag is "1"', () => {
    expect(resolveBrowserLeg('1')).toBe(e2eOpenAuthSession);
  });

  it('returns the real WebBrowser leg when the flag is unset or not "1"', () => {
    expect(resolveBrowserLeg(undefined)).toBe(WebBrowser.openAuthSessionAsync);
    expect(resolveBrowserLeg('0')).toBe(WebBrowser.openAuthSessionAsync);
    expect(resolveBrowserLeg('true')).toBe(WebBrowser.openAuthSessionAsync);
  });
});

describe('e2eOpenAuthSession', () => {
  it('extracts the state, calls /test-token, and returns the deep link as success', async () => {
    const deepLink = 'travelplanner://auth?code=minted-one-time-code';
    const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify(successEnvelope(deepLink, '/api/v1/auth/mobile/test-token')), {
        status: 200,
      }),
    );

    const result = await e2eOpenAuthSession(AUTHORISE_URL);

    expect(result).toEqual({ type: 'success', url: deepLink });
    const [calledUrl, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toBe(`${BASE_URL}/api/v1/auth/mobile/test-token`);
    expect(JSON.parse(init.body as string)).toEqual({ state: 'the-live-state' });
  });

  it('returns a ?error=server_error deep link when the endpoint fails', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify(errorEnvelope('not_found', 404, '/api/v1/auth/mobile/test-token')),
        {
          status: 404,
        },
      ),
    );

    const result = await e2eOpenAuthSession(AUTHORISE_URL);

    expect(result).toEqual({ type: 'success', url: 'travelplanner://auth?error=server_error' });
  });

  it('returns a ?error=server_error deep link when the authorise URL has no state', async () => {
    const spy = jest.spyOn(globalThis, 'fetch');

    const result = await e2eOpenAuthSession(
      'https://accounts.google.test/o/oauth2/v2/auth?foo=bar',
    );

    expect(result).toEqual({ type: 'success', url: 'travelplanner://auth?error=server_error' });
    expect(spy).not.toHaveBeenCalled();
  });
});
