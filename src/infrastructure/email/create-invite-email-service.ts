import type { InviteEmailService } from '@/application/ports/invite-email-service';
import { LoggingEmailService } from './logging-email-service';
import { ResendEmailService } from './resend-email-service';

const DEFAULT_EMAIL_FROM_ADDRESS = 'hello@mail.matthewcarr.dev';
const DEFAULT_EMAIL_FROM_NAME = 'Travel Planner';

function isConfiguredValue(value: string | undefined): value is string {
  if (!value) return false;
  const normalized = value.trim();
  if (normalized.length === 0) return false;
  if (normalized.toLowerCase().includes('replace-with')) return false;
  return true;
}

function resolveFromAddress(env: Partial<NodeJS.ProcessEnv>): string {
  return isConfiguredValue(env.EMAIL_FROM_ADDRESS)
    ? env.EMAIL_FROM_ADDRESS
    : DEFAULT_EMAIL_FROM_ADDRESS;
}

function resolveFromName(env: Partial<NodeJS.ProcessEnv>): string {
  return isConfiguredValue(env.EMAIL_FROM_NAME) ? env.EMAIL_FROM_NAME : DEFAULT_EMAIL_FROM_NAME;
}

export function createInviteEmailService(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): InviteEmailService {
  const fromAddress = resolveFromAddress(env);
  const fromName = resolveFromName(env);
  const environment = env.VERCEL_ENV ?? env.NODE_ENV ?? 'unknown';
  const isVercelProduction = env.VERCEL_ENV === 'production';

  if (isVercelProduction && isConfiguredValue(env.RESEND_API_KEY)) {
    return new ResendEmailService({
      apiKey: env.RESEND_API_KEY,
      fromAddress,
      fromName,
    });
  }

  return new LoggingEmailService({
    environment,
    fromAddress,
    fromName,
  });
}
