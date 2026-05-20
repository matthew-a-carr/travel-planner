/**
 * ADR 031 anonymises users by overwriting their email with
 * `deleted-{userId}@anonymized.local`. There is no dedicated column on
 * the users table; the email pattern is the marker.
 *
 * Kept in its own file so it stays unit-testable without pulling in
 * next-auth or the database client through `./auth.ts`.
 */
export function isAnonymisedEmail(email: string, userId: string): boolean {
  return email === `deleted-${userId}@anonymized.local`;
}
