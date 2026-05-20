/**
 * The redirect URI we send to Google must match the path that the
 * mobile callback handler lives at, qualified by the current host
 * (which differs between local dev, preview, and production).
 */
export function buildMobileCallbackRedirectUri(request: Request): string {
  const url = new URL(request.url);
  return `${url.origin}/api/v1/auth/mobile/callback`;
}
