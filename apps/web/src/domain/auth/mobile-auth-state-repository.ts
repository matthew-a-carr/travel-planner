/**
 * Repository for the short-lived `state` + `code_challenge` stash held
 * between `POST /api/v1/auth/mobile/start` and `GET /api/v1/auth/mobile/callback`.
 * See SPEC-004 §7 and ADR 051 §3.
 *
 * Rows are single-use (`consumedAt` set on successful callback) and
 * short-lived (120s TTL). Opportunistic GC happens on each `create`.
 */

export type MobileAuthStateRecord = {
  readonly id: string;
  readonly state: string;
  readonly codeChallenge: string;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
};

export type CreateMobileAuthStateInput = {
  readonly state: string;
  readonly codeChallenge: string;
  readonly expiresAt: Date;
};

export interface MobileAuthStateRepository {
  create(input: CreateMobileAuthStateInput): Promise<MobileAuthStateRecord>;
  findByState(state: string): Promise<MobileAuthStateRecord | null>;
  markConsumed(id: string, consumedAt: Date): Promise<void>;
}
