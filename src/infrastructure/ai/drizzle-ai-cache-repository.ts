import { eq } from 'drizzle-orm';
import type { AiCacheRepository } from '@/application/ports/ai-cache-repository';
import type { Db } from '../db/client';
import { aiCache } from '../db/schema';

export class DrizzleAiCacheRepository implements AiCacheRepository {
  constructor(private readonly db: Db) {}

  async get<T>(hash: string): Promise<T | null> {
    const rows = await this.db.select().from(aiCache).where(eq(aiCache.hash, hash));
    const row = rows[0];
    if (!row) return null;
    if (row.expiresAt.getTime() <= Date.now()) return null;
    return row.payload as T;
  }

  async set<T>(hash: string, payload: T, ttlSeconds: number): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    const kind = hash.split(':')[0] ?? 'unknown';
    await this.db
      .insert(aiCache)
      .values({ hash, kind, payload: payload as object, createdAt: now, expiresAt })
      .onConflictDoUpdate({
        target: aiCache.hash,
        set: { payload: payload as object, createdAt: now, expiresAt },
      });
  }
}
