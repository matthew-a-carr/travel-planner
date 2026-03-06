import { and, eq, sql } from 'drizzle-orm';
import type { Db } from '@/infrastructure/db/client';
import { users } from '@/infrastructure/db/schema';

const TRUE_VALUES = ['1', 'true', 'yes', 'on'] as const;
const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);
const LOCAL_DEV_BOOTSTRAP_ADMIN_EMAIL = 'local-dev@travel-planner.local';

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) return false;
  return TRUE_VALUES.includes(normalized as (typeof TRUE_VALUES)[number]);
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim();
  if (!trimmed) return null;

  const lowered = trimmed.toLowerCase();
  const atIndex = lowered.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === lowered.length - 1) return lowered;

  const localPart = lowered.slice(0, atIndex);
  const domainPart = lowered.slice(atIndex + 1);

  if (!GMAIL_DOMAINS.has(domainPart)) return lowered;

  // Gmail treats dots as insignificant and supports plus aliases.
  const canonicalLocalPart = localPart.split('+')[0]?.replaceAll('.', '') ?? localPart;
  return `${canonicalLocalPart}@gmail.com`;
}

export function isSelfRegistrationEnabled(env: Partial<NodeJS.ProcessEnv> = process.env): boolean {
  return isTruthy(env.AUTH_SELF_REGISTRATION_ENABLED);
}

export function getAdminEmailSet(env: Partial<NodeJS.ProcessEnv> = process.env): Set<string> {
  const configured = env.AUTH_ADMIN_EMAILS;
  if (!configured) return new Set();

  const emails = configured
    .split(/[,\n;]+/)
    .map((part) => normalizeEmail(part))
    .filter((value): value is string => value !== null);

  return new Set(emails);
}

export function isConfiguredAdminEmail(
  email: string | null | undefined,
  env: Partial<NodeJS.ProcessEnv> = process.env,
): boolean {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;
  return getAdminEmailSet(env).has(normalizedEmail);
}

function isLocalDevLoginEnabled(env: Partial<NodeJS.ProcessEnv>): boolean {
  if (env.NODE_ENV === 'development') return true;
  return isTruthy(env.AUTH_ENABLE_LOCAL_DEV);
}

function isBootstrapAdminEmail(
  email: string | null | undefined,
  env: Partial<NodeJS.ProcessEnv> = process.env,
): boolean {
  if (isConfiguredAdminEmail(email, env)) return true;
  if (!isLocalDevLoginEnabled(env)) return false;
  return normalizeEmail(email) === LOCAL_DEV_BOOTSTRAP_ADMIN_EMAIL;
}

export type SignInDecision = {
  readonly allowed: boolean;
  readonly seededAdmin: boolean;
  readonly autoApprove: boolean;
};

export async function decideSignInAccess(
  db: Db,
  email: string | null | undefined,
  env: Partial<NodeJS.ProcessEnv> = process.env,
): Promise<SignInDecision> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { allowed: false, seededAdmin: false, autoApprove: false };
  }

  const seededAdmin = isBootstrapAdminEmail(normalizedEmail, env);
  if (seededAdmin) {
    return { allowed: true, seededAdmin: true, autoApprove: true };
  }

  if (isSelfRegistrationEnabled(env)) {
    return { allowed: true, seededAdmin: false, autoApprove: true };
  }

  const existingUser = await db
    .select({ isApproved: users.isApproved })
    .from(users)
    .where(sql`lower(trim(${users.email})) = ${normalizedEmail}`)
    .limit(1);

  return {
    allowed: existingUser[0]?.isApproved ?? false,
    seededAdmin: false,
    autoApprove: false,
  };
}

export async function isUserAllowedForApp(
  db: Db,
  userId: string,
  env: Partial<NodeJS.ProcessEnv> = process.env,
): Promise<boolean> {
  const rows = await db
    .select({
      email: users.email,
      isApproved: users.isApproved,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = rows[0];
  if (!user) return false;
  if (isBootstrapAdminEmail(user.email, env)) return true;
  if (isSelfRegistrationEnabled(env)) return true;
  return user.isApproved;
}

export async function isUserAccessAdmin(
  db: Db,
  userId: string,
  env: Partial<NodeJS.ProcessEnv> = process.env,
): Promise<boolean> {
  const rows = await db
    .select({
      email: users.email,
      isAdmin: users.isAdmin,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = rows[0];
  if (!user) return false;
  return user.isAdmin || isBootstrapAdminEmail(user.email, env);
}

export async function syncSeedAdminAccessByUserId(
  db: Db,
  userId: string,
  env: Partial<NodeJS.ProcessEnv> = process.env,
): Promise<void> {
  const rows = await db
    .select({
      email: users.email,
      isAdmin: users.isAdmin,
      isApproved: users.isApproved,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const user = rows[0];
  if (!user) return;
  if (!isBootstrapAdminEmail(user.email, env)) return;
  if (user.isAdmin && user.isApproved) return;

  await db
    .update(users)
    .set({
      isAdmin: true,
      isApproved: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export type SyncUserAccessOnSignInInput = {
  readonly userId: string;
  readonly email: string | null | undefined;
  readonly name: string | null | undefined;
  readonly isSeededAdmin: boolean;
  readonly shouldAutoApprove: boolean;
};

export type SplitName = {
  readonly firstName: string | null;
  readonly lastName: string | null;
};

export function splitName(name: string | null | undefined): SplitName {
  const trimmed = name?.trim() ?? '';
  if (trimmed.length === 0) return { firstName: null, lastName: null };

  const parts = trimmed.split(/\s+/);
  const firstName = parts[0] ?? null;
  const remainingParts = parts.slice(1);
  const lastName = remainingParts.length > 0 ? remainingParts.join(' ') : null;

  return { firstName, lastName };
}

export async function syncUserAccessOnSignIn(
  db: Db,
  input: SyncUserAccessOnSignInInput,
): Promise<void> {
  const normalizedEmail = normalizeEmail(input.email);
  if (!normalizedEmail) return;

  const normalizedName = input.name?.trim() || null;
  const { firstName, lastName } = splitName(normalizedName);

  const updates: Partial<typeof users.$inferInsert> = {
    updatedAt: new Date(),
    name: normalizedName,
    firstName,
    lastName,
  };

  if (input.isSeededAdmin) {
    updates.isAdmin = true;
    updates.isApproved = true;
  } else if (input.shouldAutoApprove) {
    updates.isApproved = true;
  }

  await db
    .update(users)
    .set(updates)
    .where(and(eq(users.id, input.userId), sql`lower(trim(${users.email})) = ${normalizedEmail}`));
}
