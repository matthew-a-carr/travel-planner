import NextAuth from 'next-auth';
import { authConfig } from '@/infrastructure/auth/auth.config';

const { auth } = NextAuth(authConfig);
export default auth;

export const config = {
  // /api/v1/* handle their own auth (cookie OR bearer per ADR 051) and
  // return typed error envelopes per ADR 050 — they must not be
  // intercepted by the session-redirect middleware below.
  matcher: ['/((?!api/auth|api/v1|_next/static|_next/image|favicon.ico).*)'],
};
