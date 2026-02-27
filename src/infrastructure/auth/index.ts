import { DrizzleAdapter } from '@auth/drizzle-adapter';
import NextAuth from 'next-auth';
import { db } from '../db/client';
import * as schema from '../db/schema';
import { authConfig } from './auth.config';

// `db` is the lazy Proxy from client.ts — DrizzleAdapter captures it in
// closures and only accesses its properties when an auth operation is
// performed (i.e. at request time, never during next build).
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  session: { strategy: 'jwt' },
  callbacks: {
    ...authConfig.callbacks,
    session({ session, token }) {
      if (token?.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
