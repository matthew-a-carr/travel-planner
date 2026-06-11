/**
 * Generates `docs/openapi/v1.yaml` — the published OpenAPI 3.1 contract for
 * the `/api/v1/*` surface — directly from the zod schemas in
 * `@travel-planner/shared` (SPEC-008).
 *
 * Mechanism (deviation from SPEC-008's named `@asteasolutions/zod-to-openapi`,
 * with human sign-off 2026-05-30 — see the SPEC-008 implementation notes):
 * the repo is on zod v4, whose native `z.toJSONSchema(..., { target:
 * 'draft-2020-12' })` emits exactly the JSON Schema dialect OpenAPI 3.1
 * components use. We register every wire schema in a zod registry, convert
 * the whole set in one pass (so cross-references become
 * `#/components/schemas/...` `$ref`s), then hand-assemble the `info` / `paths`
 * around those components and serialize with `yaml`. No extra schema library.
 *
 * Usage:
 *   pnpm openapi:generate   → writes docs/openapi/v1.yaml
 *   pnpm openapi:check       → exits non-zero if the committed file is stale
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ENVELOPE_VERSION,
  apiErrorEnvelopeSchema,
  apiErrorSchema,
  apiSuccessSchema,
  meResponseSchema,
  mobileAuthExchangeRequestSchema,
  mobileAuthExchangeResponseSchema,
  mobileAuthRefreshRequestSchema,
  mobileAuthRevokeRequestSchema,
  mobileAuthStartRequestSchema,
  mobileAuthStartResponseSchema,
  requestEchoSchema,
  tripDestinationSchema,
  tripDetailSchema,
  tripFixedCostSchema,
  tripSpendSummarySchema,
  tripSummarySchema,
} from '@travel-planner/shared';
import * as z from 'zod';
import { stringify } from 'yaml';

const HERE = dirname(fileURLToPath(import.meta.url));
export const OPENAPI_PATH = join(HERE, '../../../docs/openapi/v1.yaml');

/**
 * Build the `components.schemas` map from the shared zod schemas. Each entry
 * is registered with a stable `id` so inter-schema references resolve to
 * `#/components/schemas/<id>` rather than being inlined. The per-endpoint
 * success envelopes reuse the registered data schemas, so e.g. the `/me`
 * success body `$ref`s `MeResponse` instead of duplicating it.
 */
function buildComponentSchemas(): Record<string, unknown> {
  const registry = z.registry<{ id: string }>();

  // Reusable envelope pieces.
  registry.add(requestEchoSchema, { id: 'RequestEcho' });
  registry.add(apiErrorSchema, { id: 'ApiError' });
  registry.add(apiErrorEnvelopeSchema, { id: 'ApiErrorEnvelope' });

  // Endpoint payload shapes.
  registry.add(meResponseSchema, { id: 'MeResponse' });
  registry.add(mobileAuthStartRequestSchema, { id: 'MobileAuthStartRequest' });
  registry.add(mobileAuthStartResponseSchema, { id: 'MobileAuthStartResponse' });
  registry.add(mobileAuthExchangeRequestSchema, { id: 'MobileAuthExchangeRequest' });
  registry.add(mobileAuthExchangeResponseSchema, { id: 'MobileAuthTokenResponse' });
  registry.add(mobileAuthRefreshRequestSchema, { id: 'MobileAuthRefreshRequest' });
  registry.add(mobileAuthRevokeRequestSchema, { id: 'MobileAuthRevokeRequest' });
  registry.add(tripSummarySchema, { id: 'TripSummary' });
  registry.add(tripDestinationSchema, { id: 'TripDestination' });
  registry.add(tripFixedCostSchema, { id: 'TripFixedCost' });
  registry.add(tripSpendSummarySchema, { id: 'TripSpendSummary' });
  registry.add(tripDetailSchema, { id: 'TripDetail' });

  // Per-endpoint success envelopes — `data` is the registered payload schema,
  // so it resolves to a `$ref`.
  registry.add(apiSuccessSchema(meResponseSchema), { id: 'MeSuccessEnvelope' });
  registry.add(apiSuccessSchema(mobileAuthStartResponseSchema), {
    id: 'MobileAuthStartSuccessEnvelope',
  });
  registry.add(apiSuccessSchema(mobileAuthExchangeResponseSchema), {
    id: 'MobileAuthTokenSuccessEnvelope',
  });
  registry.add(apiSuccessSchema(z.array(tripSummarySchema)), {
    id: 'TripsListSuccessEnvelope',
  });
  registry.add(apiSuccessSchema(tripDetailSchema), {
    id: 'TripDetailSuccessEnvelope',
  });

  const { schemas } = z.toJSONSchema(registry, {
    target: 'draft-2020-12',
    uri: (id) => `#/components/schemas/${id}`,
  });

  // OpenAPI 3.1 components must not carry the JSON-Schema `$schema` / `$id`
  // dialect keys — strip them from each component.
  const cleaned: Record<string, unknown> = {};
  for (const [name, schema] of Object.entries(schemas)) {
    const { $schema, $id, ...rest } = schema as Record<string, unknown>;
    cleaned[name] = rest;
  }
  return cleaned;
}

const ref = (id: string) => ({ $ref: `#/components/schemas/${id}` });
const jsonBody = (id: string) => ({
  content: { 'application/json': { schema: ref(id) } },
});
const errorResponse = (description: string) => ({
  description,
  ...jsonBody('ApiErrorEnvelope'),
});

/** Assemble the full OpenAPI 3.1 document object. */
export function buildOpenApiDocument(): Record<string, unknown> {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Travel Planner API',
      version: ENVELOPE_VERSION,
      description:
        'Versioned `/api/v1/*` surface. Every 2xx body is the standard ' +
        'success envelope `{ data, request, asof, version, meta? }`; every ' +
        'non-2xx body is RFC 7807 Problem Details plus a closed `code` enum ' +
        '(`ApiErrorEnvelope`). See ADR 056.',
    },
    servers: [{ url: 'https://travel-planner.app', description: 'Production' }],
    paths: {
      '/api/v1/me': {
        get: {
          summary: 'Current authenticated user',
          security: [{ bearerAuth: [] }, { cookieSession: [] }],
          responses: {
            '200': { description: 'The authenticated user.', ...jsonBody('MeSuccessEnvelope') },
            '401': errorResponse('No valid session or bearer token.'),
            '403': errorResponse('Authenticated but not approved.'),
          },
        },
      },
      '/api/v1/auth/mobile/start': {
        post: {
          summary: 'Begin the mobile server-mediated PKCE flow',
          requestBody: { required: true, ...jsonBody('MobileAuthStartRequest') },
          responses: {
            '200': {
              description: 'Authorise URL + opaque state.',
              ...jsonBody('MobileAuthStartSuccessEnvelope'),
            },
            '400': errorResponse('Invalid request body.'),
            '429': errorResponse('Rate limited.'),
          },
        },
      },
      '/api/v1/auth/mobile/exchange': {
        post: {
          summary: 'Exchange the one-time code for a token pair',
          requestBody: { required: true, ...jsonBody('MobileAuthExchangeRequest') },
          responses: {
            '200': {
              description: 'Access + refresh token pair.',
              ...jsonBody('MobileAuthTokenSuccessEnvelope'),
            },
            '400': errorResponse('Invalid code, expired exchange code, or PKCE mismatch.'),
            '429': errorResponse('Rate limited.'),
          },
        },
      },
      '/api/v1/auth/mobile/refresh': {
        post: {
          summary: 'Rotate the refresh token for a new pair',
          requestBody: { required: true, ...jsonBody('MobileAuthRefreshRequest') },
          responses: {
            '200': {
              description: 'A new access + refresh token pair.',
              ...jsonBody('MobileAuthTokenSuccessEnvelope'),
            },
            '401': errorResponse('Refresh token reused, expired, revoked, or unknown.'),
            '429': errorResponse('Rate limited.'),
          },
        },
      },
      '/api/v1/auth/mobile/revoke': {
        post: {
          summary: 'Revoke a refresh-token chain (sign-out)',
          requestBody: { required: true, ...jsonBody('MobileAuthRevokeRequest') },
          responses: {
            '204': {
              description:
                'Revoked (idempotent; also 204 for unknown/already-revoked tokens — non-revealing).',
            },
            '400': errorResponse('Invalid request body.'),
            '429': errorResponse('Rate limited.'),
          },
        },
      },
      '/api/v1/trips': {
        get: {
          summary: "List the caller's visible trips",
          description:
            'Every trip in an organisation the authenticated user belongs to ' +
            '(org-scoped visibility), newest-created first, with a derived ' +
            'destination date range. Unpaginated in v1 (SPEC-009).',
          security: [{ bearerAuth: [] }, { cookieSession: [] }],
          responses: {
            '200': {
              description: 'The visible trips (empty array when none).',
              ...jsonBody('TripsListSuccessEnvelope'),
            },
            '401': errorResponse('No valid session or bearer token.'),
          },
        },
      },
      '/api/v1/trips/{id}': {
        get: {
          summary: 'Composite trip detail: timeline legs + spend summary',
          description:
            'The trip, its destinations (with per-destination recorded ' +
            'spend), committed fixed costs, and the budget-vs-committed/' +
            'spent summary. 404 for unknown trips AND trips outside the ' +
            "caller's organisations (non-revealing). See SPEC-010.",
          security: [{ bearerAuth: [] }, { cookieSession: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Trip id.',
            },
          ],
          responses: {
            '200': {
              description: 'The trip detail.',
              ...jsonBody('TripDetailSuccessEnvelope'),
            },
            '401': errorResponse('No valid session or bearer token.'),
            '404': errorResponse('Unknown trip, or not visible to the caller.'),
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        cookieSession: { type: 'apiKey', in: 'cookie', name: 'authjs.session-token' },
      },
      schemas: buildComponentSchemas(),
    },
  };
}

/** Deterministic YAML serialization of the OpenAPI document. */
export function renderOpenApiYaml(): string {
  return stringify(buildOpenApiDocument(), { sortMapEntries: false });
}

/**
 * Pure drift check used by `--check`. `committed` is the on-disk YAML (or
 * `null` if the file is missing). Returns `ok: false` with a remediation
 * message when the committed file is stale or absent.
 */
export function checkDrift(committed: string | null): { ok: boolean; message: string } {
  if (committed === null) {
    return { ok: false, message: `OpenAPI spec missing at ${OPENAPI_PATH} — run \`pnpm openapi:generate\`.` };
  }
  if (committed !== renderOpenApiYaml()) {
    return {
      ok: false,
      message: 'OpenAPI spec drift detected — run `pnpm openapi:generate` and commit the result.',
    };
  }
  return { ok: true, message: 'OpenAPI spec is up to date.' };
}

function main(): void {
  if (process.argv.includes('--check')) {
    const committed = existsSync(OPENAPI_PATH) ? readFileSync(OPENAPI_PATH, 'utf8') : null;
    const { ok, message } = checkDrift(committed);
    if (!ok) {
      console.error(message);
      process.exit(1);
    }
    console.log(message);
    return;
  }

  writeFileSync(OPENAPI_PATH, renderOpenApiYaml(), 'utf8');
  console.log(`Wrote ${OPENAPI_PATH}`);
}

// Only run when invoked as a CLI (not when imported by the test).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
