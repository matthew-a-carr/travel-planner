/**
 * pkce.ts test. Mocks `expo-crypto` to use Node's `crypto` module so
 * the SHA-256 + randomBytes calls produce real, deterministic-where-it-
 * matters output under jest (which runs in Node, not on-device).
 *
 * The `require('node:crypto')` happens *inside* the jest.mock factory
 * closures rather than at the top of the file — jest hoists `jest.mock`
 * above imports and forbids out-of-scope variable references except
 * for `mock`-prefixed names.
 */

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  CryptoEncoding: { BASE64: 'base64' },
  digestStringAsync: jest.fn(async (_algorithm: string, data: string, _options: unknown) => {
    // Jest runs in Node, where node:crypto is available. expo-crypto is mocked
    // here because the real module's native bindings can't run under jest.
    const nodeCrypto = require('node:crypto');
    return nodeCrypto.createHash('sha256').update(data).digest('base64');
  }),
  getRandomBytesAsync: jest.fn(async (n: number) => {
    const nodeCrypto = require('node:crypto');
    const buf = nodeCrypto.randomBytes(n);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }),
}));

import { generateVerifier, verifierToChallenge } from '../../src/auth/pkce';

describe('generateVerifier', () => {
  it('returns a 43-character base64url string', async () => {
    const verifier = await generateVerifier();
    expect(verifier).toHaveLength(43);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('returns different values across calls', async () => {
    const a = await generateVerifier();
    const b = await generateVerifier();
    expect(a).not.toBe(b);
  });

  it('never includes characters outside the base64url alphabet', async () => {
    // Spot-check 20 verifiers for any stray `+`, `/`, or `=`.
    for (let i = 0; i < 20; i++) {
      const verifier = await generateVerifier();
      expect(verifier).not.toMatch(/[+/=]/);
    }
  });
});

describe('verifierToChallenge', () => {
  it('returns a stable SHA-256 base64url hash for a known verifier', async () => {
    // SHA-256("hello") in base64url, hand-computed via:
    //   crypto.createHash('sha256').update('hello').digest('base64url')
    //   → 'LPJNul-wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ'
    const challenge = await verifierToChallenge('hello');
    expect(challenge).toBe('LPJNul-wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ');
  });

  it('returns a 43-character base64url string for any 43-char verifier', async () => {
    const verifier = await generateVerifier();
    const challenge = await verifierToChallenge(verifier);
    expect(challenge).toHaveLength(43);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('produces different challenges for different verifiers', async () => {
    const a = await verifierToChallenge('verifier-one');
    const b = await verifierToChallenge('verifier-two');
    expect(a).not.toBe(b);
  });
});
