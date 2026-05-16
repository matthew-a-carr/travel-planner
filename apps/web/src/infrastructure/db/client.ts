import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// POSTGRES_URL must be set at server startup.
//
// During `next build`, Next.js evaluates server modules to collect static page
// data. No actual queries run at that point, but a real drizzle instance must
// be created so that DrizzleAdapter (used by Auth.js) can inspect its type via
// instanceof checks. A Proxy wrapping an empty object fails those checks.
//
// The solution: CI supplies a syntactically-valid dummy URL
// (POSTGRES_URL=postgresql://build:build@localhost:5432/build) for the build
// step only. Local build verification can use the same value manually. The
// postgres library is lazy — no TCP connection is opened until the first query —
// so the dummy URL is completely harmless at build time.
//
// `next start` spawns a fresh Node.js process and re-evaluates all modules
// with the real POSTGRES_URL, so the dummy value never reaches a live server.
function createDb() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('POSTGRES_URL environment variable is required');
  }
  const sql = postgres(connectionString);
  return drizzle(sql, { schema });
}

export const db = createDb();

export type Db = typeof db;
