/**
 * Server-side helpers for the standardised `/api/v1/*` response
 * envelope (SPEC-007 / ADR 056).
 *
 * - `respondWithData` builds a 2xx envelope around a typed resource.
 * - `buildRequestEcho` is the shared echo builder reused by
 *   `respondWithError` over in `./errors`.
 *
 * Every authenticated v1 endpoint sets `Cache-Control: no-store`
 * (ADR 056 §Decision item 7's default).
 */

import { ENVELOPE_VERSION, type RequestEcho } from '@travel-planner/shared';

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

function isHttpMethod(method: string): method is HttpMethod {
  return (HTTP_METHODS as readonly string[]).includes(method);
}

/**
 * Build the `request` echo for the envelope. Limited by helper
 * signature to method + path + path_params + query_params — body and
 * headers are NEVER echoed (ADR 056 §Decision item 3, PII safety).
 *
 * `query_params` flattens single-value keys to strings and preserves
 * multi-value keys as arrays, matching `URLSearchParams` semantics.
 */
export function buildRequestEcho(
  request: Request,
  pathParams: Record<string, string> = {},
): RequestEcho {
  const url = new URL(request.url);
  const queryParams: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    queryParams[key] = values.length === 1 ? (values[0] as string) : values;
  }
  const method = isHttpMethod(request.method) ? request.method : 'GET';
  return {
    method,
    path: url.pathname,
    path_params: pathParams,
    query_params: queryParams,
  };
}

export type RespondWithDataOpts = {
  readonly status?: number;
  readonly meta?: Record<string, unknown>;
  readonly pathParams?: Record<string, string>;
  readonly headers?: HeadersInit;
};

/**
 * Build a 2xx success envelope around `data`. The envelope's
 * `request`, `asof`, and `version` siblings are populated server-side
 * from `request` + `Date.now()` + `ENVELOPE_VERSION`.
 */
export function respondWithData<T>(
  request: Request,
  data: T,
  opts: RespondWithDataOpts = {},
): Response {
  const body: Record<string, unknown> = {
    data,
    request: buildRequestEcho(request, opts.pathParams ?? {}),
    asof: new Date().toISOString(),
    version: ENVELOPE_VERSION,
  };
  if (opts.meta !== undefined) {
    body.meta = opts.meta;
  }

  const headers = new Headers(opts.headers ?? {});
  if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-store');
  }

  return Response.json(body, {
    status: opts.status ?? 200,
    headers,
  });
}
