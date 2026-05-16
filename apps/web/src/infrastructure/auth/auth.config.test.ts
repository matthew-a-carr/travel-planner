import { describe, expect, it } from 'vitest';
import { authConfig } from './auth.config';

describe('auth.config', () => {
  it('trusts host headers for dynamic preview deployments', () => {
    expect(authConfig.trustHost).toBe(true);
  });

  it('uses the custom login route', () => {
    expect(authConfig.pages?.signIn).toBe('/login');
  });
});
