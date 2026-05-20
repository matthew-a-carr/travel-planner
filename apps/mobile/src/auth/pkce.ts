import * as Crypto from 'expo-crypto';

/**
 * PKCE primitives (RFC 7636). Pure async functions over `expo-crypto`.
 *
 * The verifier is 32 random bytes encoded as base64url without padding
 * (= 43 chars). The challenge is SHA-256(verifier) likewise base64url-
 * encoded. Both formats are RFC-compliant and accepted by the existing
 * `/api/v1/auth/mobile/start` and `/api/v1/auth/mobile/exchange`
 * endpoints (SPEC-004), which require 43–128 chars.
 */

const VERIFIER_BYTE_LENGTH = 32;

const BASE64URL_LOOKUP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export async function generateVerifier(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(VERIFIER_BYTE_LENGTH);
  return base64urlEncode(bytes);
}

export async function verifierToChallenge(verifier: string): Promise<string> {
  const base64 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  return base64ToBase64url(base64);
}

function base64urlEncode(bytes: Uint8Array): string {
  let result = '';
  const len = bytes.length;
  let i = 0;
  while (i < len) {
    const b1 = bytes[i] as number;
    const b2 = i + 1 < len ? (bytes[i + 1] as number) : 0;
    const b3 = i + 2 < len ? (bytes[i + 2] as number) : 0;
    result += BASE64URL_LOOKUP[b1 >> 2];
    result += BASE64URL_LOOKUP[((b1 & 0x03) << 4) | (b2 >> 4)];
    if (i + 1 < len) result += BASE64URL_LOOKUP[((b2 & 0x0f) << 2) | (b3 >> 6)];
    if (i + 2 < len) result += BASE64URL_LOOKUP[b3 & 0x3f];
    i += 3;
  }
  return result;
}

function base64ToBase64url(input: string): string {
  return input.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
