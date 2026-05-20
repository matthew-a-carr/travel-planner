import { SignJWT } from 'jose';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { signAccessToken, verifyAccessToken } from './bearer-token';

const SIGNING_KEY = 'test-only-signing-key-32-bytes-min-please';
const OTHER_KEY = 'different-signing-key-not-matching-anywhere';
const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

const ORIGINAL_KEY = process.env.AUTH_JWT_SIGNING_KEY;

beforeEach(() => {
  process.env.AUTH_JWT_SIGNING_KEY = SIGNING_KEY;
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) {
    delete process.env.AUTH_JWT_SIGNING_KEY;
  } else {
    process.env.AUTH_JWT_SIGNING_KEY = ORIGINAL_KEY;
  }
});

describe('signAccessToken', () => {
  it('produces a JWT that verifyAccessToken accepts', async () => {
    const jwt = await signAccessToken({ userId: USER_ID });
    const result = await verifyAccessToken(jwt);
    expect(result).toEqual({ ok: true, value: { userId: USER_ID } });
  });

  it('produces a JWS with three dot-separated segments', async () => {
    const jwt = await signAccessToken({ userId: USER_ID });
    expect(jwt.split('.')).toHaveLength(3);
  });

  it('honours ttlSeconds override', async () => {
    const jwt = await signAccessToken({ userId: USER_ID, ttlSeconds: 1 });
    // The token is valid now.
    expect((await verifyAccessToken(jwt)).ok).toBe(true);
    // After 1.5 seconds it should be expired.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const expired = await verifyAccessToken(jwt);
    expect(expired).toEqual({ ok: false, error: 'expired' });
  });

  it('defaults to a 15-minute TTL', async () => {
    const beforeIssue = Math.floor(Date.now() / 1000);
    const jwt = await signAccessToken({ userId: USER_ID });
    const payload = decodePayload(jwt);
    expect(payload.exp).toBeGreaterThanOrEqual(beforeIssue + 15 * 60 - 1);
    expect(payload.exp).toBeLessThanOrEqual(beforeIssue + 15 * 60 + 2);
  });

  it('sets iss=travel-planner-api', async () => {
    const jwt = await signAccessToken({ userId: USER_ID });
    expect(decodePayload(jwt).iss).toBe('travel-planner-api');
  });

  it('sets sub=userId', async () => {
    const jwt = await signAccessToken({ userId: USER_ID });
    expect(decodePayload(jwt).sub).toBe(USER_ID);
  });

  it('throws when AUTH_JWT_SIGNING_KEY is missing', async () => {
    delete process.env.AUTH_JWT_SIGNING_KEY;
    await expect(signAccessToken({ userId: USER_ID })).rejects.toThrow(
      /AUTH_JWT_SIGNING_KEY/,
    );
  });
});

describe('verifyAccessToken', () => {
  it('returns ok with userId for a valid token', async () => {
    const jwt = await signAccessToken({ userId: USER_ID });
    const result = await verifyAccessToken(jwt);
    expect(result).toEqual({ ok: true, value: { userId: USER_ID } });
  });

  it('returns error: missing for an empty input', async () => {
    expect(await verifyAccessToken('')).toEqual({ ok: false, error: 'missing' });
  });

  it('returns error: malformed for a non-JWT input', async () => {
    expect(await verifyAccessToken('not-a-jwt')).toEqual({ ok: false, error: 'malformed' });
    expect(await verifyAccessToken('a.b')).toEqual({ ok: false, error: 'malformed' });
  });

  it('returns error: signature_invalid when signed with a different key', async () => {
    process.env.AUTH_JWT_SIGNING_KEY = OTHER_KEY;
    const jwt = await signAccessToken({ userId: USER_ID });
    process.env.AUTH_JWT_SIGNING_KEY = SIGNING_KEY;
    expect(await verifyAccessToken(jwt)).toEqual({ ok: false, error: 'signature_invalid' });
  });

  it('returns error: expired when exp is in the past', async () => {
    // Sign with a -1 second TTL — already expired.
    const key = new TextEncoder().encode(SIGNING_KEY);
    const now = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_ID)
      .setIssuer('travel-planner-api')
      .setIssuedAt(now - 100)
      .setExpirationTime(now - 1)
      .sign(key);
    expect(await verifyAccessToken(jwt)).toEqual({ ok: false, error: 'expired' });
  });

  it('returns error: claims_invalid when iss is wrong', async () => {
    const key = new TextEncoder().encode(SIGNING_KEY);
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_ID)
      .setIssuer('some-other-api')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(key);
    expect(await verifyAccessToken(jwt)).toEqual({ ok: false, error: 'claims_invalid' });
  });

  it('returns error: claims_invalid when sub is missing', async () => {
    const key = new TextEncoder().encode(SIGNING_KEY);
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('travel-planner-api')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(key);
    expect(await verifyAccessToken(jwt)).toEqual({ ok: false, error: 'claims_invalid' });
  });
});

function decodePayload(jwt: string): {
  sub?: string;
  iss?: string;
  iat?: number;
  exp?: number;
} {
  const segment = jwt.split('.')[1];
  if (!segment) throw new Error('JWT missing payload segment');
  const padded = segment.padEnd(segment.length + ((4 - (segment.length % 4)) % 4), '=');
  const decoded = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(decoded);
}
