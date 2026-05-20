/**
 * Postgres sliding-window rate-limit counter for `/api/v1/auth/mobile/*`
 * per SPEC-004 §3 / ADR 054.
 *
 * `recordAndCount` does two things in one round-trip:
 *   1. Insert one row with the given key + endpoint + occurredAt.
 *   2. Return the count of rows for the same key within the sliding
 *      window `[occurredAt - windowMs, occurredAt]`.
 * The insert always happens (so the row counts toward future
 * decisions); the use case then decides 200 or 429 based on the
 * returned count vs the configured threshold.
 *
 * `gcOlderThan` is called opportunistically (e.g. inside the same
 * transaction as the insert) to keep table size bounded.
 */

export type RecordAndCountInput = {
  readonly key: string;
  readonly endpoint: string;
  readonly occurredAt: Date;
  readonly windowMs: number;
};

export type RecordAndCountResult = {
  /**
   * Number of rows in the sliding window AFTER the insert (so the
   * just-inserted row counts).
   */
  readonly windowCount: number;
};

export interface AuthRateLimitRepository {
  recordAndCount(input: RecordAndCountInput): Promise<RecordAndCountResult>;
  /**
   * Delete rows older than `olderThan` for a specific key. Returns the
   * number of rows deleted (informational; callers do not branch on it).
   */
  gcOlderThan(key: string, olderThan: Date): Promise<number>;
}
