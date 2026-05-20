/**
 * apiClient.ts tests. Network mocking via `jest.spyOn(globalThis, 'fetch')` —
 * each test installs its own canned response and asserts the wrapper's
 * behaviour. See SPEC-006 deviation log for why we're not using msw.
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

afterEach(() => {
  jest.restoreAllMocks();
});

describe('apiPost', () => {
  it('parses a 200 body via the response schema', async () => {
    mockFetch(
      new Response(JSON.stringify({ message: 'you said: hi' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await apiPost('/api/v1/echo', { greeting: 'hi' }, echoResponseSchema);

    expect(result).toEqual({ ok: true, data: { message: 'you said: hi' } });
  });

  it('serialises the body as JSON and sets Content-Type', async () => {
    const spy = mockFetch(new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));

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
    const spy = mockFetch(new Response(JSON.stringify({ message: 'ok' }), { status: 200 }));

    await apiPost('/api/v1/echo', {}, echoResponseSchema, 'access-token-xyz');

    const init = spy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer access-token-xyz',
      'Content-Type': 'application/json',
    });
  });

  it('parses a 400 envelope via apiErrorBodySchema and returns failure', async () => {
    mockFetch(
      new Response(
        JSON.stringify({ error: { code: 'validation_failed', message: 'Bad input.' } }),
        {
          status: 400,
        },
      ),
    );

    const result = await apiPost('/api/v1/echo', {}, echoResponseSchema);

    expect(result).toEqual({
      ok: false,
      error: { code: 'validation_failed', message: 'Bad input.' },
    });
  });

  it('falls back to internal when the error body is malformed', async () => {
    mockFetch(new Response(JSON.stringify({ totally: 'not an envelope' }), { status: 500 }));

    const result = await apiPost('/api/v1/echo', {}, echoResponseSchema);

    expect(result).toEqual({
      ok: false,
      error: { code: 'internal', message: 'Unexpected error.' },
    });
  });

  it('returns "Could not reach the server" when fetch rejects', async () => {
    mockFetch(new TypeError('Network request failed'));

    const result = await apiPost('/api/v1/echo', {}, echoResponseSchema);

    expect(result).toEqual({
      ok: false,
      error: { code: 'internal', message: 'Could not reach the server.' },
    });
  });

  it('returns "Could not reach the server" when the response body is not JSON', async () => {
    mockFetch(new Response('<html>oops</html>', { status: 502 }));

    const result = await apiPost('/api/v1/echo', {}, echoResponseSchema);

    expect(result).toEqual({
      ok: false,
      error: { code: 'internal', message: 'Could not reach the server.' },
    });
  });

  it('throws when the success body does not match the schema (wire-shape drift)', async () => {
    mockFetch(new Response(JSON.stringify({ wrong_field: true }), { status: 200 }));

    await expect(apiPost('/api/v1/echo', {}, echoResponseSchema)).rejects.toThrow();
  });
});

describe('apiGet', () => {
  it('parses a 200 body via the response schema and includes the bearer when provided', async () => {
    const spy = mockFetch(
      new Response(JSON.stringify({ message: 'pong' }), {
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
    const spy = mockFetch(new Response(JSON.stringify({ message: 'pong' }), { status: 200 }));

    await apiGet('/api/v1/echo', echoResponseSchema);

    const init = spy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect((init?.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});
