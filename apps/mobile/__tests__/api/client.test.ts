/**
 * apiClient.ts tests. Network mocking via `jest.spyOn(globalThis, 'fetch')` —
 * each test installs its own canned response and asserts the wrapper's
 * behaviour. See SPEC-006 deviation log for why we're not using msw.
 *
 * After SPEC-007 / ADR 056 every /api/v1/* response carries the new
 * envelope: 2xx bodies have `data` + `request` + `asof` + `version`;
 * non-2xx bodies have `error` (RFC 7807 + closed `code`) + the same
 * siblings.
 */

import { z } from 'zod';
import { apiGet, apiPost } from '../../src/api/client';

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

const echoResponseSchema = z.object({
  message: z.string(),
});

function mockFetch(response: Response | Error): jest.SpyInstance {
  const spy = jest.spyOn(globalThis, 'fetch');
  if (response instanceof Error) {
    spy.mockRejectedValueOnce(response);
  } else {
    spy.mockResolvedValueOnce(response);
  }
  return spy;
}

function successEnvelope<T>(data: T, path: string): Record<string, unknown> {
  return {
    data,
    request: { method: 'POST', path, path_params: {}, query_params: {} },
    asof: '2026-05-21T18:00:00.000Z',
    version: '1.1.0',
  };
}

function errorEnvelope(
  code: string,
  detail: string,
  status: number,
  path: string,
): Record<string, unknown> {
  return {
    error: {
      type: `https://travel-planner.app/errors/${code}`,
      title: 'Mock title',
      status,
      detail,
      instance: path,
      code,
    },
    request: { method: 'POST', path, path_params: {}, query_params: {} },
    asof: '2026-05-21T18:00:00.000Z',
    version: '1.1.0',
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('apiPost', () => {
  it('unwraps data from the success envelope', async () => {
    mockFetch(
      new Response(JSON.stringify(successEnvelope({ message: 'you said: hi' }, '/api/v1/echo')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await apiPost('/api/v1/echo', { greeting: 'hi' }, echoResponseSchema);

    expect(result).toEqual({ ok: true, data: { message: 'you said: hi' } });
  });

  it('serialises the body as JSON and sets Content-Type', async () => {
    const spy = mockFetch(
      new Response(JSON.stringify(successEnvelope({ message: 'ok' }, '/api/v1/echo')), {
        status: 200,
      }),
    );

    await apiPost('/api/v1/echo', { greeting: 'hi' }, echoResponseSchema);

    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0] ?? [];
    expect(url).toBe(`${BASE_URL}/api/v1/echo`);
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(init?.body).toBe(JSON.stringify({ greeting: 'hi' }));
  });

  it('forwards the bearer token in the Authorization header', async () => {
    const spy = mockFetch(
      new Response(JSON.stringify(successEnvelope({ message: 'ok' }, '/api/v1/echo')), {
        status: 200,
      }),
    );

    await apiPost('/api/v1/echo', {}, echoResponseSchema, 'access-token-xyz');

    const init = spy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer access-token-xyz',
      'Content-Type': 'application/json',
    });
  });

  it('parses a 400 envelope via apiErrorEnvelopeSchema and returns failure with the RFC 7807 error', async () => {
    mockFetch(
      new Response(
        JSON.stringify(errorEnvelope('validation_failed', 'Bad input.', 400, '/api/v1/echo')),
        { status: 400 },
      ),
    );

    const result = await apiPost('/api/v1/echo', {}, echoResponseSchema);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('validation_failed');
    expect(result.error.detail).toBe('Bad input.');
    expect(result.error.status).toBe(400);
    expect(result.error.type).toBe('https://travel-planner.app/errors/validation_failed');
  });

  it('falls back to a synthetic internal error when the error body is malformed', async () => {
    mockFetch(new Response(JSON.stringify({ totally: 'not an envelope' }), { status: 500 }));

    const result = await apiPost('/api/v1/echo', {}, echoResponseSchema);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('internal');
    expect(result.error.detail).toBe('Unexpected error.');
    expect(result.error.instance).toBe('/api/v1/echo');
  });

  it('returns "Could not reach the server" when fetch rejects', async () => {
    mockFetch(new TypeError('Network request failed'));

    const result = await apiPost('/api/v1/echo', {}, echoResponseSchema);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('internal');
    expect(result.error.detail).toBe('Could not reach the server.');
    expect(result.error.instance).toBe('/api/v1/echo');
  });

  it('returns "Could not reach the server" when the response body is not JSON', async () => {
    mockFetch(new Response('<html>oops</html>', { status: 502 }));

    const result = await apiPost('/api/v1/echo', {}, echoResponseSchema);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('internal');
    expect(result.error.detail).toBe('Could not reach the server.');
  });

  it('throws when the success envelope is missing required siblings (wire-shape drift)', async () => {
    // Body is the raw resource shape without the envelope siblings.
    mockFetch(new Response(JSON.stringify({ message: 'hi' }), { status: 200 }));

    await expect(apiPost('/api/v1/echo', {}, echoResponseSchema)).rejects.toThrow();
  });

  it('throws when the success data does not match the schema', async () => {
    mockFetch(
      new Response(JSON.stringify(successEnvelope({ wrong_field: true }, '/api/v1/echo')), {
        status: 200,
      }),
    );

    await expect(apiPost('/api/v1/echo', {}, echoResponseSchema)).rejects.toThrow();
  });
});

describe('apiGet', () => {
  it('unwraps data from the success envelope and includes the bearer when provided', async () => {
    const spy = mockFetch(
      new Response(JSON.stringify(successEnvelope({ message: 'pong' }, '/api/v1/echo')), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await apiGet('/api/v1/echo', echoResponseSchema, 'bearer-abc');

    expect(result).toEqual({ ok: true, data: { message: 'pong' } });
    const init = spy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.method).toBe('GET');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer bearer-abc' });
    // GET requests don't carry a JSON body, so no Content-Type header.
    expect((init?.headers as Record<string, string>)['Content-Type']).toBeUndefined();
  });

  it('omits the Authorization header when no bearer is supplied', async () => {
    const spy = mockFetch(
      new Response(JSON.stringify(successEnvelope({ message: 'pong' }, '/api/v1/echo')), {
        status: 200,
      }),
    );

    await apiGet('/api/v1/echo', echoResponseSchema);

    const init = spy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});
