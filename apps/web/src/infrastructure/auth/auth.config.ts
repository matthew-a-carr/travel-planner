import type { NextAuthConfig } from 'next-auth';

export const authConfig: NextAuthConfig = {
  // Providers are configured in auth/index.ts. Middleware only needs
  // route protection callbacks and custom page paths.
  providers: [],
  // Required for Vercel preview hosts where AUTH_URL is not static.
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLoginPage = nextUrl.pathname.startsWith('/login');
      const isOnPublicPath = nextUrl.pathname === '/' || isOnLoginPage;

      if (isOnPublicPath) return true;
      if (!isLoggedIn) return false;

      // Redirect logged-in but unapproved users to the login page.
      const isApproved = (auth?.user as { isApproved?: boolean } | undefined)?.isApproved;
      if (!isApproved) {
        return Response.redirect(new URL('/login', nextUrl));
      }

      return true;
    },
    // Preserve isApproved in the JWT so the session callback below can
    // expose it.  The full auth config in index.ts overrides this with a
    // richer jwt callback that also fetches isApproved from the DB on
    // sign-in; this minimal version just passes through the existing
    // claim so the edge middleware (proxy.ts) works correctly.
    jwt({ token }) {
      return token;
    },
    // Copy isApproved from the JWT into session.user so the `authorized`
    // callback above can read it.  Without this the middleware-only
    // NextAuth instance (proxy.ts) never populates the field and every
    // authenticated user gets redirected to /login.
    session({ session, token }) {
      if (session.user) {
        (session.user as { isApproved?: boolean }).isApproved =
          (token as { isApproved?: boolean }).isApproved ?? false;
      }
      return session;
    },
  },
};
