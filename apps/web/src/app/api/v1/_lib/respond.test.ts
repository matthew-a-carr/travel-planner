import { apiSuccessSchema, ENVELOPE_VERSION } from '@travel-planner/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildRequestEcho, respondWithData } from './respond';

function fakeRequest(input: {
  url?: string;
  method?: string;
  headers?: HeadersInit;
}): Request {
  return new Request(input.url ?? 'http://localhost/api/v1/me', {
    method: input.method ?? 'GET',
    headers: input.headers,
  });
}

describe('buildRequestEcho', () => {
  it('echoes method + path with empty params for the simplest case', () => {
    const echo = buildRequestEcho(fakeRequest({}));
    expect(echo).toEqual({
      method: 'GET',
      path: '/api/v1/me',
      path_params: {},
      query_params: {},
    });
  });

  it('coerces an unknown method to GET (defensive)', () => {
    const echo = buildRequestEcho(fakeRequest({ method: 'CUSTOM' as never }));
    expect(echo.method).toBe('GET');
  });

  it('extracts query params as strings', () => {
    const echo = buildRequestEcho(
      fakeRequest({ url: 'http://localhost/api/v1/x?month=2026-05&tag=food' }),
    );
    expect(echo.query_params).toEqual({ month: '2026-05', tag: 'food' });
  });

  it('preserves multi-value query params as arrays', () => {
    const echo = buildRequestEcho(
      fakeRequest({ url: 'http://localhost/api/v1/x?tag=a&tag=b&tag=c' }),
    );
    expect(echo.query_params).toEqual({ tag: ['a', 'b', 'c'] });
  });

  it('attaches caller-supplied pathParams verbatim', () => {
    const echo = buildRequestEcho(fakeRequest({ url: 'http://localhost/api/v1/trips/abc-123' }), {
      id: 'abc-123',
    });
    expect(echo.path_params).toEqual({ id: 'abc-123' });
  });

  it('does NOT echo the Authorization header', () => {
    const echo = buildRequestEcho(
      fakeRequest({ headers: { Authorization: 'Bearer secret-token' } }),
    );
    expect(JSON.stringify(echo)).not.toContain('secret-token');
    expect(JSON.stringify(echo)).not.toContain('Authorization');
  });
});

describe('respondWithData', () => {
  const dataSchema = z.object({ id: z.string(), email: z.string() });

  it('builds a complete success envelope', async () => {
    const response = respondWithData(
      fakeRequest({}),
      { id: 'u1', email: 'a@b.c' },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    const parsed = apiSuccessSchema(dataSchema).parse(body);
    expect(parsed.data).toEqual({ id: 'u1', email: 'a@b.c' });
    expect(parsed.version).toBe(ENVELOPE_VERSION);
    expect(parsed.request.path).toBe('/api/v1/me');
  });

  it('formats asof as RFC 3339 UTC with millisecond precision', async () => {
    const response = respondWithData(fakeRequest({}), { id: '1', email: 'x@y.z' });
    const body = await response.json();
    const parsed = apiSuccessSchema(dataSchema).parse(body);
    expect(parsed.asof).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('sets Cache-Control: no-store by default', () => {
    const response = respondWithData(fakeRequest({}), { id: '1', email: 'x@y.z' });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('lets callers override the status (e.g. 201 Created)', async () => {
    const response = respondWithData(
      fakeRequest({ method: 'POST', url: 'http://localhost/api/v1/trips' }),
      { id: 'new' },
      { status: 201 },
    );
    expect(response.status).toBe(201);
  });

  it('attaches caller-supplied meta', async () => {
    const response = respondWithData(
      fakeRequest({}),
      { id: '1', email: 'x@y.z' },
      { meta: { pagination: { page: 1, total: 100 } } },
    );
    const body = (await response.json()) as { meta?: unknown };
    expect(body.meta).toEqual({ pagination: { page: 1, total: 100 } });
  });

  it('omits meta when not supplied', async () => {
    const response = respondWithData(fakeRequest({}), { id: '1', email: 'x@y.z' });
    const body = (await response.json()) as Record<string, unknown>;
    expect('meta' in body).toBe(false);
  });

  it('attaches pathParams when provided', async () => {
    const response = respondWithData(
      fakeRequest({ url: 'http://localhost/api/v1/trips/abc-123' }),
      { id: 'abc-123' },
      { pathParams: { id: 'abc-123' } },
    );
    const body = (await response.json()) as { request: { path_params: Record<string, string> } };
    expect(body.request.path_params).toEqual({ id: 'abc-123' });
  });

  it('echoes the request method', async () => {
    const response = respondWithData(
      fakeRequest({ method: 'POST', url: 'http://localhost/api/v1/auth/mobile/start' }),
      { ok: true },
    );
    const body = (await response.json()) as { request: { method: string } };
    expect(body.request.method).toBe('POST');
  });

  it('uses application/json content type', () => {
    const response = respondWithData(fakeRequest({}), { id: '1' });
    expect(response.headers.get('content-type')).toContain('application/json');
  });
});
