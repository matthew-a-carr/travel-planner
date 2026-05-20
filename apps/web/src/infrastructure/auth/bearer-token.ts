import { errors as joseErrors, jwtVerify, SignJWT } from 'jose';

/**
 * HS256 access-token signing + verification for /api/v1/* bearer auth.
 * See ADR 051 (Mobile Authentication Model) and docs/api-conventions.md
 * for the full model. Slice 2 ships verification; slice 3 ships the
 * PKCE issuance flow and refresh-token rotation.
 */

const ISSUER = 'travel-planner-api';
const DEFAULT_TTL_SECONDS = 15 * 60;

export type VerifiedAccessToken = {
  readonly userId: string;
};

export type AccessTokenError =
  | 'missing'
  | 'malformed'
  | 'signature_invalid'
  | 'expired'
  | 'claims_invalid';

export type VerifyAccessTokenResult =
  | { readonly ok: true; readonly value: VerifiedAccessToken }
  | { readonly ok: false; readonly error: AccessTokenError };

export type SignAccessTokenInput = {
  readonly userId: string;
  readonly ttlSeconds?: number;
};

function getSigningKey(): Uint8Array {
  const value = process.env.AUTH_JWT_SIGNING_KEY;
  if (!value) {
    throw new Error('AUTH_JWT_SIGNING_KEY environment variable is required');
  }
  return new TextEncoder().encode(value);
}

export async function signAccessToken(input: SignAccessTokenInput): Promise<string> {
  const key = getSigningKey();
  const ttlSeconds = input.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.userId)
    .setIssuer(ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .sign(key);
}

export async function verifyAccessToken(jwt: string): Promise<VerifyAccessTokenResult> {
  if (!jwt) return { ok: false, error: 'missing' };

  // Basic shape check — jose throws JWSInvalid which we'd otherwise have to
  // map; doing the segment count up front gives a clearer error category.
  if (jwt.split('.').length !== 3) return { ok: false, error: 'malformed' };

  const key = getSigningKey();

  try {
    const { payload } = await jwtVerify(jwt, key, {
      algorithms: ['HS256'],
      issuer: ISSUER,
    });

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      return { ok: false, error: 'claims_invalid' };
    }

    return { ok: true, value: { userId: payload.sub } };
  } catch (error) {
    return { ok: false, error: categoriseJoseError(error) };
  }
}

function categoriseJoseError(error: unknown): AccessTokenError {
  if (error instanceof joseErrors.JWTExpired) return 'expired';
  if (error instanceof joseErrors.JWTClaimValidationFailed) return 'claims_invalid';
  if (
    error instanceof joseErrors.JWSSignatureVerificationFailed ||
    error instanceof joseErrors.JWSInvalid
  ) {
    return 'signature_invalid';
  }
  if (error instanceof joseErrors.JWTInvalid) return 'malformed';
  // Unrecognised — log for diagnosis and fall through as signature_invalid
  // since that's the safest assumption for any verifier failure we don't
  // categorise (we never want to silently grant access).
  console.warn('[bearer-token] uncategorised verify error', error);
  return 'signature_invalid';
}
