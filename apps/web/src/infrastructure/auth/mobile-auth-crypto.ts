/**
 * Concrete `MobileAuthCrypto` implementation backed by `jose` for JWT
 * signing and Web Crypto for SHA-256 + random bytes. See SPEC-004 §7
 * and ADR 051 §1–§2.
 */

import type {
  MintedRefreshToken,
  MobileAuthCrypto,
  SignAccessTokenInput,
} from '@/domain/auth/mobile-auth-crypto';
import { signAccessToken as signAccessTokenInfra } from './bearer-token';

const REFRESH_TOKEN_BYTE_LENGTH = 32;

export class WebCryptoMobileAuthCrypto implements MobileAuthCrypto {
  randomBase64url(byteLength: number): string {
    const bytes = new Uint8Array(byteLength);
    crypto.getRandomValues(bytes);
    return toBase64url(bytes);
  }

  async sha256Base64url(input: string): Promise<string> {
    const encoded = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return toBase64url(new Uint8Array(digest));
  }

  async mintRefreshToken(): Promise<MintedRefreshToken> {
    const cleartext = this.randomBase64url(REFRESH_TOKEN_BYTE_LENGTH);
    const hash = await this.sha256Base64url(cleartext);
    return { cleartext, hash };
  }

  async signAccessToken(input: SignAccessTokenInput): Promise<string> {
    // Delegates to the existing helper from SPEC-002 so cookie sessions
    // and mobile bearer tokens are signed by identical machinery.
    return signAccessTokenInfra({
      userId: input.userId,
      ttlSeconds: input.ttlSeconds,
    });
  }
}

function toBase64url(bytes: Uint8Array): string {
  // Node 18+ Buffer supports base64url directly; fall back to manual
  // encoding for non-Node runtimes (tests run in Node so the fast path
  // is fine, but the fallback keeps the function portable to edge
  // runtimes that may not expose Buffer).
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64url');
  }
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
