/**
 * PKCE S256 challenge comparison.
 *
 * The actual SHA-256 hashing of the `code_verifier` happens in the
 * application layer (Web Crypto's `subtle.digest` is async; domain is
 * sync-pure per the layer rules). This function performs a constant-time
 * comparison between the application-computed challenge and the
 * challenge that was stored at `/auth/mobile/start`.
 *
 * Constant-time so the verifier cannot be brute-forced character by
 * character via timing differences in the response.
 */

import type { PkceMatchResult } from './types';

const MISMATCH: PkceMatchResult = { ok: false, error: 'pkce_mismatch' };

export function verifyPkceChallengeMatch(
  computedChallenge: string,
  storedChallenge: string,
): PkceMatchResult {
  // Empty input is never legitimate — guards against bugs elsewhere
  // accidentally short-circuiting verification.
  if (computedChallenge.length === 0 || storedChallenge.length === 0) {
    return MISMATCH;
  }
  return constantTimeStringEqual(computedChallenge, storedChallenge)
    ? { ok: true, value: true }
    : MISMATCH;
}

function constantTimeStringEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
