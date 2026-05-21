/**
 * Postgres sliding-window rate-limit wrapper per SPEC-004 §3 / ADR 054.
 *
 * Thresholds:
 *   - 30 / IP / 5min        (overall)
 *   - 10 / IP+endpoint / 5min (per-endpoint)
 *   - 60 / user / 5min      (refresh only — caller supplies the userId)
 *
 * Behaviour on breach: `429 rate_limited` with the standard envelope.
 * The insert always happens BEFORE the count, so the just-arrived
 * attempt is included in the decision.
 */

import type { AuthRateLimitRepository } from '@/domain/auth/auth-rate-limit-repository';
import { respondWithError } from '../../../_lib/errors';

const WINDOW_MS = 5 * 60 * 1000;
const IP_THRESHOLD = 30;
const IP_ENDPOINT_THRESHOLD = 10;
const USER_THRESHOLD = 60;

export type RateLimitInput = {
  readonly request: Request;
  readonly endpoint: string;
  readonly userId?: string | null;
  readonly repo: AuthRateLimitRepository;
};

/**
 * @returns 429 Response if any threshold is breached, or `null` when
 * the request is allowed through. Caller continues with its normal
 * handler logic only when this returns null.
 */
export async function rateLimitOrReject(input: RateLimitInput): Promise<Response | null> {
  const { request, endpoint, userId, repo } = input;
  const ip = clientIp(request);
  const now = new Date();

  // IP+endpoint counter.
  const ipEndpoint = await repo.recordAndCount({
    key: `ip:${ip}#endpoint:${endpoint}`,
    endpoint,
    occurredAt: now,
    windowMs: WINDOW_MS,
  });
  if (ipEndpoint.windowCount > IP_ENDPOINT_THRESHOLD) {
    return respondWithError(request, 'rate_limited', {
      detail: `Too many requests to /${endpoint}; try again in a few minutes.`,
    });
  }

  // IP-wide counter (covers any of the four endpoints).
  const ipAny = await repo.recordAndCount({
    key: `ip:${ip}`,
    endpoint,
    occurredAt: now,
    windowMs: WINDOW_MS,
  });
  if (ipAny.windowCount > IP_THRESHOLD) {
    return respondWithError(request, 'rate_limited', {
      detail: 'Too many auth requests; try again in a few minutes.',
    });
  }

  // Optional per-user counter for /refresh.
  if (userId) {
    const userCount = await repo.recordAndCount({
      key: `user:${userId}`,
      endpoint,
      occurredAt: now,
      windowMs: WINDOW_MS,
    });
    if (userCount.windowCount > USER_THRESHOLD) {
      return respondWithError(request, 'rate_limited', {
        detail: 'Too many refreshes for this account; try again later.',
      });
    }
  }

  return null;
}

function clientIp(request: Request): string {
  // Vercel forwards the original IP in x-forwarded-for; fall back to
  // 0.0.0.0 in tests where headers are absent.
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip')?.trim() ??
    '0.0.0.0'
  );
}
