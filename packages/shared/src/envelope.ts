import { z } from 'zod';
import { apiErrorCodeSchema } from './api-errors';

/**
 * Standardised `/api/v1/*` response envelope schemas (SPEC-007 / ADR 056).
 *
 * Every `/api/v1/*` response — success or error — carries `request`,
 * `asof`, and `version` siblings around its primary payload. Success
 * responses wrap a resource in `data`; error responses wrap a
 * RFC 7807-style problem-details object (plus our closed `code` enum)
 * in `error`. Streaming endpoints carve out — see ADR 056 §8 — and do
 * not wrap individual SSE events.
 */

// ---------------------------------------------------------------------------
// Request echo
// ---------------------------------------------------------------------------

/**
 * What the server tells the client it received. Limited to
 * method + path + path/query params on purpose — body and headers can
 * leak secrets (`code_verifier`, `refresh_token`, `Authorization`).
 *
 * `query_params` allows either a single string or an array of strings
 * per key because `URLSearchParams` preserves repeats.
 */
export const requestEchoSchema = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string().min(1),
  path_params: z.record(z.string(), z.string()),
  query_params: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
});
export type RequestEcho = z.infer<typeof requestEchoSchema>;

// ---------------------------------------------------------------------------
// `asof` — RFC 3339 UTC, millisecond precision
// ---------------------------------------------------------------------------

/**
 * Canonical timestamp format for the envelope: `YYYY-MM-DDTHH:mm:ss.sssZ`.
 * Node's `new Date().toISOString()` produces this exact shape. No
 * timezone offsets other than `Z`; no missing milliseconds.
 */
const asofPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
export const asofSchema = z
  .string()
  .regex(asofPattern, 'asof must be RFC 3339 UTC with millisecond precision');

// ---------------------------------------------------------------------------
// `version` — semver string matching package.json#version
// ---------------------------------------------------------------------------

const semverPattern = /^\d+\.\d+\.\d+$/;
export const versionSchema = z.string().regex(semverPattern);

// ---------------------------------------------------------------------------
// Success envelope (2xx)
// ---------------------------------------------------------------------------

/**
 * Build a per-endpoint success envelope schema from the inner `data`
 * schema. Usage:
 *
 * ```ts
 * const meSuccess = apiSuccessSchema(meResponseSchema);
 * meSuccess.parse(body); // { data: MeResponse, request, asof, version, meta? }
 * ```
 */
export function apiSuccessSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    request: requestEchoSchema,
    asof: asofSchema,
    version: versionSchema,
    meta: z.record(z.string(), z.unknown()).optional(),
  });
}

// ---------------------------------------------------------------------------
// Error envelope (non-2xx) — RFC 7807 Problem Details + closed `code`
// ---------------------------------------------------------------------------

/**
 * Inner error object. RFC 7807 fields (`type`, `title`, `status`,
 * `detail`, `instance`) sit alongside our closed `code` enum so
 * clients keep compile-time exhaustive switching on `code`.
 *
 * - `type`: stable URI identifier, one per `code`. Pattern:
 *   `https://travel-planner.app/errors/<code>`.
 * - `status`: mirrors the HTTP response status (400–599).
 * - `instance`: the request path that produced the error.
 * - `details`: per-code free-form payload (e.g. `field_errors`,
 *   `retry_after_seconds`).
 */
export const apiErrorSchema = z.object({
  type: z.string().url(),
  title: z.string().min(1),
  status: z.number().int().min(400).max(599),
  detail: z.string().min(1),
  instance: z.string().min(1),
  code: apiErrorCodeSchema,
  details: z.record(z.string(), z.unknown()).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/**
 * Full error response envelope: `error` + the same `request` / `asof`
 * / `version` siblings as success.
 */
export const apiErrorEnvelopeSchema = z.object({
  error: apiErrorSchema,
  request: requestEchoSchema,
  asof: asofSchema,
  version: versionSchema,
});
export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;
