import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import pkg from '../package.json';
import {
  apiErrorEnvelopeSchema,
  apiErrorSchema,
  apiSuccessSchema,
  asofSchema,
  requestEchoSchema,
  versionSchema,
} from './envelope';
import { ENVELOPE_VERSION } from './version';

describe('requestEchoSchema', () => {
  const valid = {
    method: 'GET',
    path: '/api/v1/me',
    path_params: {},
    query_params: {},
  };

  it('accepts a minimal well-formed echo', () => {
    expect(() => requestEchoSchema.parse(valid)).not.toThrow();
  });

  it('accepts populated path_params and query_params', () => {
    const populated = {
      method: 'GET',
      path: '/api/v1/trips/abc-123/spend',
      path_params: { id: 'abc-123' },
      query_params: { month: '2026-05', tag: ['food', 'travel'] },
    };
    expect(() => requestEchoSchema.parse(populated)).not.toThrow();
  });

  it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const)('accepts method %s', (method) => {
    expect(() => requestEchoSchema.parse({ ...valid, method })).not.toThrow();
  });

  it('rejects an unknown method', () => {
    expect(() => requestEchoSchema.parse({ ...valid, method: 'OPTIONS' })).toThrow();
  });

  it('rejects an empty path', () => {
    expect(() => requestEchoSchema.parse({ ...valid, path: '' })).toThrow();
  });

  it('rejects missing path_params', () => {
    const { path_params: _, ...rest } = valid;
    expect(() => requestEchoSchema.parse(rest)).toThrow();
  });
});

describe('asofSchema (RFC 3339 UTC ms-precision)', () => {
  it('accepts the output of new Date().toISOString()', () => {
    const now = new Date().toISOString();
    expect(() => asofSchema.parse(now)).not.toThrow();
  });

  it('accepts a literal well-formed value', () => {
    expect(() => asofSchema.parse('2026-05-21T14:32:11.123Z')).not.toThrow();
  });

  it('rejects a non-UTC offset', () => {
    expect(() => asofSchema.parse('2026-05-21T14:32:11.123+00:00')).toThrow();
    expect(() => asofSchema.parse('2026-05-21T14:32:11.123-05:00')).toThrow();
  });

  it('rejects missing milliseconds', () => {
    expect(() => asofSchema.parse('2026-05-21T14:32:11Z')).toThrow();
  });

  it('rejects microsecond precision', () => {
    expect(() => asofSchema.parse('2026-05-21T14:32:11.123456Z')).toThrow();
  });

  it('rejects a date-only string', () => {
    expect(() => asofSchema.parse('2026-05-21')).toThrow();
  });
});

describe('versionSchema', () => {
  it.each(['1.1.0', '0.0.1', '12.34.56'])('accepts %s', (v) => {
    expect(() => versionSchema.parse(v)).not.toThrow();
  });

  it.each(['1.1', '1.1.0-beta', '1.1.0+abc', 'v1.1.0', ''])('rejects %s', (v) => {
    expect(() => versionSchema.parse(v)).toThrow();
  });
});

describe('apiSuccessSchema', () => {
  const dataSchema = z.object({ id: z.string(), name: z.string() });
  const validBody = {
    data: { id: 'abc', name: 'Test' },
    request: {
      method: 'GET' as const,
      path: '/api/v1/me',
      path_params: {},
      query_params: {},
    },
    asof: '2026-05-21T14:32:11.123Z',
    version: '1.1.0',
  };

  it('parses a complete success envelope', () => {
    expect(() => apiSuccessSchema(dataSchema).parse(validBody)).not.toThrow();
  });

  it('parses with optional meta populated', () => {
    expect(() =>
      apiSuccessSchema(dataSchema).parse({ ...validBody, meta: { extra: 'info' } }),
    ).not.toThrow();
  });

  it('parses without meta (optional)', () => {
    expect(() => apiSuccessSchema(dataSchema).parse(validBody)).not.toThrow();
  });

  it('rejects missing data', () => {
    const { data: _, ...rest } = validBody;
    expect(() => apiSuccessSchema(dataSchema).parse(rest)).toThrow();
  });

  it('rejects missing request', () => {
    const { request: _, ...rest } = validBody;
    expect(() => apiSuccessSchema(dataSchema).parse(rest)).toThrow();
  });

  it('rejects missing asof', () => {
    const { asof: _, ...rest } = validBody;
    expect(() => apiSuccessSchema(dataSchema).parse(rest)).toThrow();
  });

  it('rejects missing version', () => {
    const { version: _, ...rest } = validBody;
    expect(() => apiSuccessSchema(dataSchema).parse(rest)).toThrow();
  });

  it('rejects malformed asof inside the envelope', () => {
    expect(() =>
      apiSuccessSchema(dataSchema).parse({ ...validBody, asof: '2026-05-21' }),
    ).toThrow();
  });

  it('rejects data that does not match the inner schema', () => {
    expect(() =>
      apiSuccessSchema(dataSchema).parse({ ...validBody, data: { id: 'abc' } }),
    ).toThrow();
  });
});

describe('apiErrorSchema (RFC 7807 + code)', () => {
  const validError = {
    type: 'https://travel-planner.app/errors/refresh_expired',
    title: 'Refresh token has expired',
    status: 401,
    detail: 'Sign in again to continue.',
    instance: '/api/v1/auth/mobile/refresh',
    code: 'refresh_expired' as const,
  };

  it('parses a complete error', () => {
    expect(() => apiErrorSchema.parse(validError)).not.toThrow();
  });

  it('accepts optional details', () => {
    expect(() =>
      apiErrorSchema.parse({
        ...validError,
        details: { field_errors: [{ field: 'email', code: 'invalid' }] },
      }),
    ).not.toThrow();
  });

  it('requires the code field', () => {
    const { code: _, ...rest } = validError;
    expect(() => apiErrorSchema.parse(rest)).toThrow();
  });

  it('rejects an unknown code', () => {
    expect(() => apiErrorSchema.parse({ ...validError, code: 'made_up_code' })).toThrow();
  });

  it('rejects a non-URL type', () => {
    expect(() => apiErrorSchema.parse({ ...validError, type: 'not a url' })).toThrow();
  });

  it('rejects status below 400', () => {
    expect(() => apiErrorSchema.parse({ ...validError, status: 200 })).toThrow();
    expect(() => apiErrorSchema.parse({ ...validError, status: 399 })).toThrow();
  });

  it('rejects status above 599', () => {
    expect(() => apiErrorSchema.parse({ ...validError, status: 600 })).toThrow();
  });

  it('rejects non-integer status', () => {
    expect(() => apiErrorSchema.parse({ ...validError, status: 404.5 })).toThrow();
  });

  it('rejects empty title', () => {
    expect(() => apiErrorSchema.parse({ ...validError, title: '' })).toThrow();
  });

  it('rejects empty detail', () => {
    expect(() => apiErrorSchema.parse({ ...validError, detail: '' })).toThrow();
  });

  it('rejects empty instance', () => {
    expect(() => apiErrorSchema.parse({ ...validError, instance: '' })).toThrow();
  });
});

describe('apiErrorEnvelopeSchema', () => {
  const validEnvelope = {
    error: {
      type: 'https://travel-planner.app/errors/unauthenticated',
      title: 'Authentication required',
      status: 401,
      detail: 'Sign in to continue.',
      instance: '/api/v1/me',
      code: 'unauthenticated' as const,
    },
    request: {
      method: 'GET' as const,
      path: '/api/v1/me',
      path_params: {},
      query_params: {},
    },
    asof: '2026-05-21T14:32:11.123Z',
    version: '1.1.0',
  };

  it('parses a complete error envelope', () => {
    expect(() => apiErrorEnvelopeSchema.parse(validEnvelope)).not.toThrow();
  });

  it('rejects an envelope without request echo', () => {
    const { request: _, ...rest } = validEnvelope;
    expect(() => apiErrorEnvelopeSchema.parse(rest)).toThrow();
  });

  it('rejects an envelope without asof', () => {
    const { asof: _, ...rest } = validEnvelope;
    expect(() => apiErrorEnvelopeSchema.parse(rest)).toThrow();
  });

  it('rejects an envelope without version', () => {
    const { version: _, ...rest } = validEnvelope;
    expect(() => apiErrorEnvelopeSchema.parse(rest)).toThrow();
  });
});

describe('ENVELOPE_VERSION', () => {
  it('is a semver string', () => {
    expect(ENVELOPE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('equals packages/shared/package.json#version (single source of truth)', () => {
    expect(ENVELOPE_VERSION).toBe(pkg.version);
  });

  it('is currently 1.2.0 (trips list endpoint, SPEC-009 — minor per ADR 056)', () => {
    expect(ENVELOPE_VERSION).toBe('1.2.0');
  });
});
