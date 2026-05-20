/**
 * Domain port grouping the three crypto-y dependencies the mobile auth
 * use cases need.
 *
 * Concrete implementation lives in
 * `src/infrastructure/auth/mobile-auth-crypto.ts`. The real impl uses
 * `jose` (already a direct dep) for JWT signing and Web Crypto for
 * SHA-256 + random bytes.
 *
 * Grouping them into a single port keeps the use-case constructor
 * signature manageable and reflects that they are conceptually one
 * concern (cryptographic primitives wired together for this auth flow).
 */

export type MintedRefreshToken = {
  /** Cleartext token returned to the client once and never logged. */
  readonly cleartext: string;
  /** sha256(cleartext) base64url — what we persist. */
  readonly hash: string;
};

export type SignAccessTokenInput = {
  readonly userId: string;
  readonly ttlSeconds: number;
};

export interface MobileAuthCrypto {
  /**
   * Cryptographically random URL-safe string. Used for `state`,
   * one-time exchange codes, and refresh tokens (32 bytes → 43 chars
   * base64url).
   */
  randomBase64url(byteLength: number): string;

  /**
   * SHA-256 of the input, base64url-encoded (no padding). Used for the
   * refresh-token and exchange-code hash columns, plus the PKCE
   * verifier-to-challenge conversion.
   */
  sha256Base64url(input: string): Promise<string>;

  /**
   * Mint a fresh refresh token: cleartext + its sha256 hash, in one
   * step so callers can't accidentally log the cleartext while
   * computing the hash.
   */
  mintRefreshToken(): Promise<MintedRefreshToken>;

  /**
   * Sign a 15-minute HS256 access JWT for the given user. Returns the
   * compact JWT string.
   */
  signAccessToken(input: SignAccessTokenInput): Promise<string>;
}
