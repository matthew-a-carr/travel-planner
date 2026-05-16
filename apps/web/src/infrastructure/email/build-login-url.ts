function sanitizeBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return '';
  return trimmed.replace(/\/+$/, '');
}

export function resolveAppBaseUrl(env: Partial<NodeJS.ProcessEnv> = process.env): string {
  const authUrl = sanitizeBaseUrl(env.AUTH_URL ?? '');
  if (authUrl.length > 0) return authUrl;

  const vercelUrl = sanitizeBaseUrl(env.VERCEL_URL ?? '');
  if (vercelUrl.length > 0) {
    const withoutProtocol = vercelUrl.replace(/^https?:\/\//, '');
    return `https://${withoutProtocol}`;
  }

  return 'http://localhost:3000';
}

export function buildLoginUrl(env: Partial<NodeJS.ProcessEnv> = process.env): string {
  return `${resolveAppBaseUrl(env)}/login`;
}
