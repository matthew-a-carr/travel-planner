const CONFIG_PLACEHOLDER_PREFIXES = ['replace-with-', 'dev-placeholder-'] as const;

function isConfiguredValue(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;

  return !CONFIG_PLACEHOLDER_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

export function isDevLocalLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'development';
}

export function isGoogleConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return isConfiguredValue(env.AUTH_GOOGLE_ID) && isConfiguredValue(env.AUTH_GOOGLE_SECRET);
}

export type VisibleSignInProviders = {
  showGoogle: boolean;
  showLocalDev: boolean;
};

export function getVisibleSignInProviders(
  env: NodeJS.ProcessEnv = process.env,
): VisibleSignInProviders {
  return {
    showGoogle: isGoogleConfigured(env),
    showLocalDev: isDevLocalLoginEnabled(env),
  };
}
