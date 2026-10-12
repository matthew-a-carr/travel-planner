export function isGoogleEmailVerified(
  account: { provider?: string | null } | null | undefined,
  profile: unknown,
): boolean {
  if (account?.provider !== 'google') return true;
  if (!profile || typeof profile !== 'object') return false;

  const emailVerified = (profile as { email_verified?: unknown }).email_verified;
  return (
    emailVerified === true ||
    emailVerified === 'true' ||
    emailVerified === 1 ||
    emailVerified === '1'
  );
}
