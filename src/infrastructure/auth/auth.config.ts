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
      if (isLoggedIn) return true;
      return false;
    },
  },
};
