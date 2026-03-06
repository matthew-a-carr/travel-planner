export function isGoogleEmailVerified(
  account: { provider?: string | null } | null | undefined,
  profile: unknown,
): boolean {
  if (account?.provider !== 'google') return true;
  if (!profile || typeof profile !== 'object') return true;

  const emailVerified = (profile as { email_verified?: unknown }).email_verified;
  if (emailVerified === false || emailVerified === 'false' || emailVerified === 0) return false;
  return true;
}
