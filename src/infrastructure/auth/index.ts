import NextAuth from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { authConfig } from './auth.config';
import * as schema from '../db/schema';

function getDb() {
  const connectionString = process.env['POSTGRES_URL'];
  if (!connectionString) {
    throw new Error('POSTGRES_URL environment variable is required');
  }
  const sql = postgres(connectionString);
  return drizzle(sql, { schema });
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(getDb(), {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  session: { strategy: 'jwt' },
});
