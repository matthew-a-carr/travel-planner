import { describe, expect, it } from 'vitest';
import { isGoogleEmailVerified } from './google-email-verification';

describe('google-email-verification', () => {
  it('accepts non-google providers without requiring email_verified', () => {
    expect(isGoogleEmailVerified({ provider: 'local-dev' }, {})).toBe(true);
    expect(isGoogleEmailVerified(null, null)).toBe(true);
  });

  it('accepts supported truthy email_verified variants', () => {
    expect(isGoogleEmailVerified({ provider: 'google' }, { email_verified: true })).toBe(true);
    expect(isGoogleEmailVerified({ provider: 'google' }, { email_verified: 'true' })).toBe(true);
    expect(isGoogleEmailVerified({ provider: 'google' }, { email_verified: 1 })).toBe(true);
    expect(isGoogleEmailVerified({ provider: 'google' }, { email_verified: '1' })).toBe(true);
  });

  it.each([false, 'false', 0, '0', undefined, null, '', 'yes', {}, []])(
    'rejects Google profiles without an explicitly verified email: %j',
    (email_verified) => {
      expect(isGoogleEmailVerified({ provider: 'google' }, { email_verified })).toBe(false);
    },
  );

  it('rejects missing Google profiles', () => {
    expect(isGoogleEmailVerified({ provider: 'google' }, null)).toBe(false);
    expect(isGoogleEmailVerified({ provider: 'google' }, undefined)).toBe(false);
  });
});
