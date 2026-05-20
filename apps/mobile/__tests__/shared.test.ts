/**
 * Bundler + parse smoke test for @travel-planner/shared on the mobile
 * side. Proves that:
 *   1. Metro resolves the pnpm workspace symlink at
 *      apps/mobile/node_modules/@travel-planner/shared.
 *   2. jest-expo's transform pipeline accepts the package's source-only
 *      TypeScript exports.
 *   3. zod runs under the RN bundle (no Node-only globals trip it).
 *
 * Slice 6's sign-in UI is the first real consumer; this test exists so
 * a Metro / jest-expo / zod incompatibility surfaces at SPEC-005 close-out
 * rather than mid-slice 6.
 */

import {
  meResponseSchema,
  mobileAuthCallbackErrorSchema,
  mobileAuthExchangeResponseSchema,
} from '@travel-planner/shared';

describe('@travel-planner/shared (mobile bundler smoke)', () => {
  it('parses a representative MobileAuthExchangeResponse', () => {
    const parsed = mobileAuthExchangeResponseSchema.parse({
      access_token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.sig',
      refresh_token: 'opaque-rotating-token-bytes',
      access_expires_at: '2026-05-20T12:00:00.000Z',
    });

    expect(parsed.access_token).toBe('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.sig');
    expect(parsed.refresh_token).toBe('opaque-rotating-token-bytes');
    expect(parsed.access_expires_at).toBe('2026-05-20T12:00:00.000Z');
  });

  it('parses a representative MeResponse with a null name', () => {
    const parsed = meResponseSchema.parse({
      id: 'user-uuid',
      email: 'matt@example.com',
      name: null,
      isApproved: true,
    });

    expect(parsed.name).toBeNull();
    expect(parsed.isApproved).toBe(true);
  });

  it('exposes the MobileAuthCallbackError closed set via .options', () => {
    expect(mobileAuthCallbackErrorSchema.options).toEqual([
      'invalid_request',
      'server_error',
      'invalid_state',
      'google_error',
      'access_denied',
    ]);
  });
});
