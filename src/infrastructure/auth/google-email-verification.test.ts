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

  it('rejects google profiles without verified email', () => {
    expect(isGoogleEmailVerified({ provider: 'google' }, { email_verified: false })).toBe(false);
    expect(isGoogleEmailVerified({ provider: 'google' }, { email_verified: 'false' })).toBe(
      false,
    );
    expect(isGoogleEmailVerified({ provider: 'google' }, {})).toBe(false);
    expect(isGoogleEmailVerified({ provider: 'google' }, null)).toBe(false);
  });
});
