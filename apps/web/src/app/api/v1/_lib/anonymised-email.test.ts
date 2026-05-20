import { describe, expect, it } from 'vitest';
import { isAnonymisedEmail } from './anonymised-email';

describe('isAnonymisedEmail (ADR 031 marker)', () => {
  const userId = '550e8400-e29b-41d4-a716-446655440000';

  it('returns true for the canonical anonymised email pattern', () => {
    expect(isAnonymisedEmail(`deleted-${userId}@anonymized.local`, userId)).toBe(true);
  });

  it('returns false for a real user email', () => {
    expect(isAnonymisedEmail('matt@example.com', userId)).toBe(false);
  });

  it('returns false when the userId in the pattern does not match', () => {
    const otherId = 'd2a4f6b8-1234-5678-9abc-def012345678';
    expect(isAnonymisedEmail(`deleted-${otherId}@anonymized.local`, userId)).toBe(false);
  });

  it('returns false for a similar-looking pattern with a wrong domain', () => {
    expect(isAnonymisedEmail(`deleted-${userId}@example.com`, userId)).toBe(false);
  });

  it('returns false for a similar-looking pattern with a wrong prefix', () => {
    expect(isAnonymisedEmail(`removed-${userId}@anonymized.local`, userId)).toBe(false);
  });

  it('returns false for an empty email', () => {
    expect(isAnonymisedEmail('', userId)).toBe(false);
  });

  it('is case-sensitive on the prefix and domain (matches ADR 031 exactly)', () => {
    expect(isAnonymisedEmail(`DELETED-${userId}@anonymized.local`, userId)).toBe(false);
    expect(isAnonymisedEmail(`deleted-${userId}@ANONYMIZED.LOCAL`, userId)).toBe(false);
  });
});
