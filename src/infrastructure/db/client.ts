import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Lazily initialised — intentionally not created at module evaluation time.
//
// `next build` statically analyses pages and imports server modules without a
// real POSTGRES_URL present. Eagerly calling createDb() here would throw during
// the build step and break CI. The connection is only established when the first
// repository method is called (i.e. on a real incoming request), at which point
// POSTGRES_URL is guaranteed to be set by the runtime environment.
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_db) {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error('POSTGRES_URL environment variable is required');
    }
    const sql = postgres(connectionString);
    _db = drizzle(sql, { schema });
  }
  return _db;
}

// Re-export as a Proxy so all existing `db.select()`, `db.insert()`, etc.
// call sites continue to work unchanged — the lazy init is transparent.
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    return getDb()[prop as keyof ReturnType<typeof drizzle<typeof schema>>];
  },
});

export type Db = typeof db;
