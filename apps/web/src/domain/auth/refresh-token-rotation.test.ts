import { describe, expect, it } from 'vitest';
import { decideRotation } from './refresh-token-rotation';
import type { RefreshTokenRecord } from './types';

const NOW = new Date('2026-05-20T12:00:00Z');
const HOUR_AGO = new Date('2026-05-20T11:00:00Z');
const HOUR_AHEAD = new Date('2026-05-20T13:00:00Z');
const DAY_AGO = new Date('2026-05-19T12:00:00Z');

function makeToken(overrides: Partial<RefreshTokenRecord> = {}): RefreshTokenRecord {
  return {
    id: 'tok-1',
    userId: 'user-1',
    tokenHash: 'hash-1',
    issuedAt: HOUR_AGO,
    expiresAt: HOUR_AHEAD,
    replacedById: null,
    revokedAt: null,
    ...overrides,
  };
}

describe('decideRotation', () => {
  it('returns rotate for a fresh active refresh token', () => {
    const result = decideRotation({
      now: NOW,
      presented: makeToken(),
      chainFromPresented: [],
    });
    expect(result).toEqual({ kind: 'rotate', presentedId: 'tok-1' });
  });

  it('returns unknown_token when the token row is not found', () => {
    const result = decideRotation({
      now: NOW,
      presented: null,
      chainFromPresented: [],
    });
    expect(result).toEqual({ kind: 'unknown_token' });
  });

  it('returns expired when expires_at is in the past', () => {
    const result = decideRotation({
      now: NOW,
      presented: makeToken({ expiresAt: DAY_AGO }),
      chainFromPresented: [],
    });
    expect(result).toEqual({ kind: 'expired' });
  });

  it('returns revoked when revoked_at is non-null', () => {
    const result = decideRotation({
      now: NOW,
      presented: makeToken({ revokedAt: HOUR_AGO }),
      chainFromPresented: [],
    });
    expect(result).toEqual({ kind: 'revoked' });
  });

  it('returns revoked even if also expired (revocation wins for clarity)', () => {
    const result = decideRotation({
      now: NOW,
      presented: makeToken({ revokedAt: HOUR_AGO, expiresAt: DAY_AGO }),
      chainFromPresented: [],
    });
    expect(result).toEqual({ kind: 'revoked' });
  });

  it('returns reused with the singleton chain when only the presented row was rotated once', () => {
    const presented = makeToken({ id: 'tok-1', replacedById: 'tok-2' });
    const successor = makeToken({ id: 'tok-2', tokenHash: 'hash-2', replacedById: null });
    const result = decideRotation({
      now: NOW,
      presented,
      chainFromPresented: [successor],
    });
    expect(result).toEqual({
      kind: 'reused',
      chainIdsToRevoke: ['tok-1', 'tok-2'],
    });
  });

  it('returns reused walking the full chain when multiple rotations have happened', () => {
    const presented = makeToken({ id: 'tok-1', replacedById: 'tok-2' });
    const t2 = makeToken({ id: 'tok-2', tokenHash: 'h2', replacedById: 'tok-3' });
    const t3 = makeToken({ id: 'tok-3', tokenHash: 'h3', replacedById: 'tok-4' });
    const t4 = makeToken({ id: 'tok-4', tokenHash: 'h4', replacedById: null });

    const result = decideRotation({
      now: NOW,
      presented,
      chainFromPresented: [t2, t3, t4],
    });

    expect(result).toEqual({
      kind: 'reused',
      chainIdsToRevoke: ['tok-1', 'tok-2', 'tok-3', 'tok-4'],
    });
  });

  it('returns reused even when the chain head is already revoked (idempotent re-revocation)', () => {
    // Attacker presents an old token that was already used to detect a
    // prior reuse — the chain may already be fully revoked. We still
    // signal `reused` so the caller can log + 401 consistently.
    const presented = makeToken({ id: 'tok-1', replacedById: 'tok-2', revokedAt: HOUR_AGO });
    const t2 = makeToken({ id: 'tok-2', tokenHash: 'h2', revokedAt: HOUR_AGO });
    const result = decideRotation({
      now: NOW,
      presented,
      chainFromPresented: [t2],
    });
    expect(result).toEqual({
      kind: 'reused',
      chainIdsToRevoke: ['tok-1', 'tok-2'],
    });
  });

  it('prioritises reused over expired when both apply', () => {
    // If the presented row is expired AND has been rotated, the reuse
    // signal is more important — an attacker holding an expired token
    // they previously rotated still triggers chain revocation.
    const presented = makeToken({
      id: 'tok-1',
      expiresAt: DAY_AGO,
      replacedById: 'tok-2',
    });
    const t2 = makeToken({ id: 'tok-2', tokenHash: 'h2' });
    const result = decideRotation({
      now: NOW,
      presented,
      chainFromPresented: [t2],
    });
    expect(result).toEqual({
      kind: 'reused',
      chainIdsToRevoke: ['tok-1', 'tok-2'],
    });
  });
});
