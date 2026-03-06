import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import NextAuth from 'next-auth';
import type { Provider } from 'next-auth/providers';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { ensureUserOrganization } from '@/application/use-cases/ensure-user-organization';
import { db } from '../db/client';
import { DrizzleOrganizationRepository } from '../db/repositories/drizzle-organization-repository';
import * as schema from '../db/schema';
import { decideSignInAccess, syncUserAccessOnSignIn } from './access-policy';
import { authConfig } from './auth.config';
import { isDevLocalLoginEnabled, isGoogleConfigured } from './provider-availability';

const LOCAL_DEV_USER_EMAIL = 'local-dev@travel-planner.local';
const LOCAL_DEV_USER_NAME = 'Local Dev User';
const LOCAL_DEV_USER_IMAGE = null;
const LOCAL_DEV_FIRST_NAME = 'Local';
const LOCAL_DEV_LAST_NAME = 'Dev User';

function isGoogleEmailVerified(
  account: { provider?: string | null } | null | undefined,
  profile: unknown,
): boolean {
  if (account?.provider !== 'google') return true;
  if (!profile || typeof profile !== 'object') return false;
  const emailVerified = (profile as { email_verified?: boolean }).email_verified;
  return emailVerified === true;
}

async function upsertLocalDevUser() {
  const existing = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      image: schema.users.image,
    })
    .from(schema.users)
    .where(eq(schema.users.email, LOCAL_DEV_USER_EMAIL))
    .limit(1);

  const existingUser = existing[0];
  if (existingUser) return existingUser;

  try {
    const inserted = await db
      .insert(schema.users)
      .values({
        name: LOCAL_DEV_USER_NAME,
        firstName: LOCAL_DEV_FIRST_NAME,
        lastName: LOCAL_DEV_LAST_NAME,
        email: LOCAL_DEV_USER_EMAIL,
        image: LOCAL_DEV_USER_IMAGE,
        isApproved: true,
        isAdmin: false,
        emailVerified: null,
      })
      .returning({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        image: schema.users.image,
      });

    const user = inserted[0];
    if (!user) throw new Error('Failed to create local dev auth user');
    return user;
  } catch (error) {
    // If the row was created concurrently (or a unique constraint exists in a
    // drifted schema), fetch and reuse it.
    const fallback = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        image: schema.users.image,
      })
      .from(schema.users)
      .where(eq(schema.users.email, LOCAL_DEV_USER_EMAIL))
      .limit(1);

    const user = fallback[0];
    if (user) return user;
    throw error;
  }
}

function buildProviders() {
  const providers: Provider[] = [];

  if (isGoogleConfigured()) {
    providers.push(
      Google({
        clientId: process.env.AUTH_GOOGLE_ID,
        clientSecret: process.env.AUTH_GOOGLE_SECRET,
      }),
    );
  }

  if (isDevLocalLoginEnabled()) {
    providers.push(
      Credentials({
        id: 'local-dev',
        name: 'Local Dev',
        credentials: {},
        async authorize() {
          const user = await upsertLocalDevUser();
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            image: user.image,
          };
        },
      }),
    );
  }

  return providers;
}

// `db` is the lazy Proxy from client.ts — DrizzleAdapter captures it in
// closures and only accesses its properties when an auth operation is
// performed (i.e. at request time, never during next build).
export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: buildProviders(),
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  events: {
    async signIn({ user }) {
      if (!user.id) return;
      const decision = await decideSignInAccess(db, user.email ?? null);
      await syncUserAccessOnSignIn(db, {
        userId: user.id,
        email: user.email ?? null,
        name: user.name ?? null,
        isSeededAdmin: decision.seededAdmin,
        shouldAutoApprove: decision.autoApprove,
      });

      await ensureUserOrganization(new DrizzleOrganizationRepository(db), {
        userId: user.id,
        userName: user.name ?? null,
        email: user.email ?? null,
      });
    },
  },
  session: { strategy: 'jwt' },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account, profile }) {
      if (!isGoogleEmailVerified(account, profile)) return false;
      const decision = await decideSignInAccess(db, user.email ?? null);
      return decision.allowed;
    },
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token, user }) {
      const userId = token.sub ?? user?.id ?? session.user?.id;
      if (session.user && userId) {
        session.user.id = userId;
      }
      return session;
    },
  },
});
