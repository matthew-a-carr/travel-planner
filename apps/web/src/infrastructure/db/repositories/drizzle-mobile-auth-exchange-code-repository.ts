import { eq, lt } from 'drizzle-orm';
import type {
  CreateMobileAuthExchangeCodeInput,
  MobileAuthExchangeCodeRecord,
  MobileAuthExchangeCodeRepository,
} from '@/domain/auth/mobile-auth-exchange-code-repository';
import type { Db } from '../client';
import { mobileAuthExchangeCodes } from '../schema';

export class DrizzleMobileAuthExchangeCodeRepository implements MobileAuthExchangeCodeRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateMobileAuthExchangeCodeInput): Promise<MobileAuthExchangeCodeRecord> {
    // Opportunistic GC of stale rows.
    await this.db
      .delete(mobileAuthExchangeCodes)
      .where(lt(mobileAuthExchangeCodes.expiresAt, new Date()));

    const [row] = await this.db
      .insert(mobileAuthExchangeCodes)
      .values({
        codeHash: input.codeHash,
        codeChallenge: input.codeChallenge,
        userId: input.userId,
        expiresAt: input.expiresAt,
      })
      .returning();

    if (!row) throw new Error('mobile_auth_exchange_codes insert returned no row');
    return toRecord(row);
  }

  async findByCodeHash(codeHash: string): Promise<MobileAuthExchangeCodeRecord | null> {
    const rows = await this.db
      .select()
      .from(mobileAuthExchangeCodes)
      .where(eq(mobileAuthExchangeCodes.codeHash, codeHash))
      .limit(1);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async markConsumed(id: string, consumedAt: Date): Promise<void> {
    await this.db
      .update(mobileAuthExchangeCodes)
      .set({ consumedAt })
      .where(eq(mobileAuthExchangeCodes.id, id));
  }
}

function toRecord(row: typeof mobileAuthExchangeCodes.$inferSelect): MobileAuthExchangeCodeRecord {
  return {
    id: row.id,
    codeHash: row.codeHash,
    codeChallenge: row.codeChallenge,
    userId: row.userId,
    expiresAt: row.expiresAt,
    consumedAt: row.consumedAt,
  };
}
