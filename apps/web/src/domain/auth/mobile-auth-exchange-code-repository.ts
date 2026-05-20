/**
 * Repository for one-time PKCE exchange codes (minted in `/callback`,
 * redeemed in `/exchange`). See SPEC-004 §7 and ADR 051 §3.
 *
 * `tokenHash` is sha256(cleartext); the cleartext is given to the
 * client once via the `travelplanner://auth?code=` redirect and never
 * stored.
 */

export type MobileAuthExchangeCodeRecord = {
  readonly id: string;
  readonly codeHash: string;
  readonly codeChallenge: string;
  readonly userId: string;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
};

export type CreateMobileAuthExchangeCodeInput = {
  readonly codeHash: string;
  readonly codeChallenge: string;
  readonly userId: string;
  readonly expiresAt: Date;
};

export interface MobileAuthExchangeCodeRepository {
  create(input: CreateMobileAuthExchangeCodeInput): Promise<MobileAuthExchangeCodeRecord>;
  findByCodeHash(codeHash: string): Promise<MobileAuthExchangeCodeRecord | null>;
  markConsumed(id: string, consumedAt: Date): Promise<void>;
}
