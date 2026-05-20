import { and, count, eq, gte, lt } from 'drizzle-orm';
import type {
  AuthRateLimitRepository,
  RecordAndCountInput,
  RecordAndCountResult,
} from '@/domain/auth/auth-rate-limit-repository';
import type { Db } from '../client';
import { authRateLimitAttempts } from '../schema';

export class DrizzleAuthRateLimitRepository implements AuthRateLimitRepository {
  constructor(private readonly db: Db) {}

  async recordAndCount(input: RecordAndCountInput): Promise<RecordAndCountResult> {
    const { key, endpoint, occurredAt, windowMs } = input;
    const windowStart = new Date(occurredAt.getTime() - windowMs);

    return this.db.transaction(async (tx) => {
      await tx.insert(authRateLimitAttempts).values({ key, endpoint, occurredAt });

      const [row] = await tx
        .select({ c: count() })
        .from(authRateLimitAttempts)
        .where(
          and(
            eq(authRateLimitAttempts.key, key),
            gte(authRateLimitAttempts.occurredAt, windowStart),
          ),
        );

      return { windowCount: Number(row?.c ?? 0) };
    });
  }

  async gcOlderThan(key: string, olderThan: Date): Promise<number> {
    const result = await this.db
      .delete(authRateLimitAttempts)
      .where(
        and(eq(authRateLimitAttempts.key, key), lt(authRateLimitAttempts.occurredAt, olderThan)),
      )
      .returning({ id: authRateLimitAttempts.id });
    return result.length;
  }
}
