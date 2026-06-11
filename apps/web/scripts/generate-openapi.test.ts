/**
 * Tests for the OpenAPI generator (SPEC-008 step 8). Asserts the emitted
 * document is well-formed OAS 3.1, that component `$ref`s resolve, that
 * `info.version` tracks the shared package, that serialization is
 * deterministic, and that the committed `docs/openapi/v1.yaml` is in sync
 * (so `pnpm openapi:check` passes) — plus the drift-detection logic both
 * ways.
 */

import { readFileSync } from 'node:fs';
import { ENVELOPE_VERSION } from '@travel-planner/shared';
import { describe, expect, it } from 'vitest';
import {
  OPENAPI_PATH,
  buildOpenApiDocument,
  checkDrift,
  renderOpenApiYaml,
} from './generate-openapi';

type Json = Record<string, unknown>;

/** Collect every `$ref` string anywhere in the document. */
function collectRefs(node: unknown, acc: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const item of node) collectRefs(item, acc);
  } else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') acc.push(value);
      else collectRefs(value, acc);
    }
  }
  return acc;
}

describe('OpenAPI generator', () => {
  const doc = buildOpenApiDocument() as Json;

  it('emits an OpenAPI 3.1 document', () => {
    expect(doc.openapi).toBe('3.1.0');
    expect((doc.info as Json).title).toBe('Travel Planner API');
    expect(doc.paths).toBeTypeOf('object');
    expect((doc.components as Json).schemas).toBeTypeOf('object');
  });

  it('info.version tracks the shared package version', () => {
    expect((doc.info as Json).version).toBe(ENVELOPE_VERSION);
  });

  it('documents every /api/v1 endpoint', () => {
    const paths = Object.keys(doc.paths as Json);
    expect(paths).toEqual(
      expect.arrayContaining([
        '/api/v1/me',
        '/api/v1/auth/mobile/start',
        '/api/v1/auth/mobile/exchange',
        '/api/v1/auth/mobile/refresh',
        '/api/v1/auth/mobile/revoke',
        '/api/v1/trips',
        '/api/v1/trips/{id}',
      ]),
    );
  });

  it('documents the trip detail payload with its nested components (SPEC-010)', () => {
    const schemas = (doc.components as Json).schemas as Json;
    for (const id of ['TripDetail', 'TripDestination', 'TripFixedCost', 'TripSpendSummary']) {
      expect(schemas[id], `missing component ${id}`).toBeTypeOf('object');
    }
    const detail = schemas.TripDetail as Json;
    const props = detail.properties as Json;
    expect(((props.destinations as Json).items as Json).$ref).toBe(
      '#/components/schemas/TripDestination',
    );
    expect(((props.fixedCosts as Json).items as Json).$ref).toBe(
      '#/components/schemas/TripFixedCost',
    );
    expect((props.spend as Json).$ref).toBe('#/components/schemas/TripSpendSummary');
    const path = (doc.paths as Json)['/api/v1/trips/{id}'] as Json;
    const params = (path.get as Json).parameters as Json[];
    expect(params?.[0]).toMatchObject({ name: 'id', in: 'path', required: true });
  });

  it('documents the trips list payload as an array of TripSummary (SPEC-009)', () => {
    const schemas = (doc.components as Json).schemas as Json;
    expect(schemas.TripSummary).toBeTypeOf('object');
    const trips = schemas.TripsListSuccessEnvelope as Json;
    const data = (trips.properties as Json).data as Json;
    expect(data.type).toBe('array');
    expect((data.items as Json).$ref).toBe('#/components/schemas/TripSummary');
  });

  it('wires every $ref to a defined component (no dangling refs)', () => {
    const schemas = (doc.components as Json).schemas as Json;
    const defined = new Set(Object.keys(schemas).map((id) => `#/components/schemas/${id}`));
    const refs = collectRefs(doc);
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) expect(defined).toContain(r);
  });

  it('success/error envelopes reference their payload components', () => {
    const schemas = (doc.components as Json).schemas as Json;
    const me = schemas.MeSuccessEnvelope as Json;
    expect(((me.properties as Json).data as Json).$ref).toBe('#/components/schemas/MeResponse');
    const err = schemas.ApiErrorEnvelope as Json;
    expect(((err.properties as Json).error as Json).$ref).toBe('#/components/schemas/ApiError');
  });

  it('serialization is deterministic', () => {
    expect(renderOpenApiYaml()).toBe(renderOpenApiYaml());
  });

  it('the committed docs/openapi/v1.yaml is in sync (openapi:check would pass)', () => {
    const committed = readFileSync(OPENAPI_PATH, 'utf8');
    expect(committed).toBe(renderOpenApiYaml());
    expect(checkDrift(committed).ok).toBe(true);
  });

  it('checkDrift reports drift when the committed file is stale or missing', () => {
    expect(checkDrift('openapi: 3.1.0\n# stale\n').ok).toBe(false);
    expect(checkDrift(null).ok).toBe(false);
    expect(checkDrift(null).message).toMatch(/openapi:generate/);
  });
});
