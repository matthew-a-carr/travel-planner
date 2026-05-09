/**
 * Persistent cache for expensive AI calls. Keyed by content hash so that
 * identical inputs are served from cache. Implementations are responsible
 * for TTL enforcement.
 */
export interface AiCacheRepository {
  get<T>(hash: string): Promise<T | null>;
  set<T>(hash: string, payload: T, ttlSeconds: number): Promise<void>;
}
