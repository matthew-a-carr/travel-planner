import { describe, expect, it } from 'vitest';
import { verifyPkceChallengeMatch } from './pkce';

describe('verifyPkceChallengeMatch', () => {
  // 43-char base64url-encoded SHA-256 hash (256 bits → 32 bytes → 43 chars).
  const validChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

  it('returns ok when the computed challenge equals the stored challenge', () => {
    const result = verifyPkceChallengeMatch(validChallenge, validChallenge);
    expect(result).toEqual({ ok: true, value: true });
  });

  it('returns pkce_mismatch when challenges differ in the middle', () => {
    const computed = validChallenge;
    const stored = `${validChallenge.slice(0, 20)}_DIFFERENT_${validChallenge.slice(31)}`;
    const result = verifyPkceChallengeMatch(computed, stored);
    expect(result).toEqual({ ok: false, error: 'pkce_mismatch' });
  });

  it('returns pkce_mismatch when challenges differ only in the last char', () => {
    const computed = validChallenge;
    const stored = `${validChallenge.slice(0, -1)}X`;
    const result = verifyPkceChallengeMatch(computed, stored);
    expect(result).toEqual({ ok: false, error: 'pkce_mismatch' });
  });

  it('returns pkce_mismatch on length difference', () => {
    const computed = validChallenge;
    const stored = `${validChallenge}extra`;
    const result = verifyPkceChallengeMatch(computed, stored);
    expect(result).toEqual({ ok: false, error: 'pkce_mismatch' });
  });

  it('returns pkce_mismatch when both sides are empty', () => {
    // Empty challenge is never legitimate — guard against the
    // "missing challenge" footgun where a bug elsewhere passes ''.
    const result = verifyPkceChallengeMatch('', '');
    expect(result).toEqual({ ok: false, error: 'pkce_mismatch' });
  });

  it('returns pkce_mismatch when only one side is empty', () => {
    expect(verifyPkceChallengeMatch('', validChallenge)).toEqual({
      ok: false,
      error: 'pkce_mismatch',
    });
    expect(verifyPkceChallengeMatch(validChallenge, '')).toEqual({
      ok: false,
      error: 'pkce_mismatch',
    });
  });
});
