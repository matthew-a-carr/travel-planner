import { eq, lt } from 'drizzle-orm';
import type {
  CreateMobileAuthStateInput,
  MobileAuthStateRecord,
  MobileAuthStateRepository,
} from '@/domain/auth/mobile-auth-state-repository';
import type { Db } from '../client';
import { mobileAuthStates } from '../schema';

export class DrizzleMobileAuthStateRepository implements MobileAuthStateRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreateMobileAuthStateInput): Promise<MobileAuthStateRecord> {
    // Opportunistic GC: drop expired rows on every insert. Keeps the
    // table small without a separate cron.
    await this.db.delete(mobileAuthStates).where(lt(mobileAuthStates.expiresAt, new Date()));

    const [row] = await this.db
      .insert(mobileAuthStates)
      .values({
        state: input.state,
        codeChallenge: input.codeChallenge,
        expiresAt: input.expiresAt,
      })
      .returning();

    if (!row) throw new Error('mobile_auth_states insert returned no row');
    return toRecord(row);
  }

  async findByState(state: string): Promise<MobileAuthStateRecord | null> {
    const rows = await this.db
      .select()
      .from(mobileAuthStates)
      .where(eq(mobileAuthStates.state, state))
      .limit(1);
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async markConsumed(id: string, consumedAt: Date): Promise<void> {
    await this.db.update(mobileAuthStates).set({ consumedAt }).where(eq(mobileAuthStates.id, id));
  }
}

function toRecord(row: typeof mobileAuthStates.$inferSelect): MobileAuthStateRecord {
  return {
    id: row.id,
    state: row.state,
    codeChallenge: row.codeChallenge,
    expiresAt: row.expiresAt,
    consumedAt: row.consumedAt,
  };
}
