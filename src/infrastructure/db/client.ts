import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

function createDb() {
  const connectionString = process.env['POSTGRES_URL'];
  if (!connectionString) {
    throw new Error('POSTGRES_URL environment variable is required');
  }
  const sql = postgres(connectionString);
  return drizzle(sql, { schema });
}

// Module-level singleton — safe in Next.js server-side context
// (each serverless invocation gets a fresh module scope)
export const db = createDb();

export type Db = typeof db;
