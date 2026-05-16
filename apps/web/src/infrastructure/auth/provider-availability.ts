const CONFIG_PLACEHOLDER_PREFIXES = ['replace-with-', 'dev-placeholder-'] as const;
const LOCAL_DEV_AUTH_TRUE_VALUES = ['1', 'true', 'yes', 'on'] as const;

function isConfiguredValue(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;

  return !CONFIG_PLACEHOLDER_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) return false;
  return LOCAL_DEV_AUTH_TRUE_VALUES.includes(
    normalized as (typeof LOCAL_DEV_AUTH_TRUE_VALUES)[number],
  );
}

export function isDevLocalLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === 'development') return true;
  return isTruthy(env.AUTH_ENABLE_LOCAL_DEV);
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
