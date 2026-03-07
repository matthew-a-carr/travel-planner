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

function canonicalEmailSql(column: typeof users.email) {
  return sql<string>`
    case
      when lower(trim(${column})) like '%@gmail.com' or lower(trim(${column})) like '%@googlemail.com'
        then replace(split_part(split_part(lower(trim(${column})), '@', 1), '+', 1), '.', '') || '@gmail.com'
      else lower(trim(${column}))
    end
  `;
}

function isLocalDevLoginEnabled(env: Partial<NodeJS.ProcessEnv>): boolean {
  if (env.NODE_ENV === 'development') return true;
  return isTruthy(env.AUTH_ENABLE_LOCAL_DEV);
}

function isBootstrapAdminEmail(
  email: string | null | undefined,
  env: Partial<NodeJS.ProcessEnv> = process.env,
): boolean {
  return isLocalDevLoginEnabled(env) && normalizeEmail(email) === LOCAL_DEV_BOOTSTRAP_ADMIN_EMAIL;
}

export type SignInDecision = {
  readonly allowed: boolean;
  readonly seededAdmin: boolean;
};

export async function decideSignInAccess(
  db: Db,
  email: string | null | undefined,
  env: Partial<NodeJS.ProcessEnv> = process.env,
): Promise<SignInDecision> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { allowed: false, seededAdmin: false };
  }

  const existingUsers = await db
    .select({
      email: users.email,
      isApproved: users.isApproved,
    })
    .from(users)
    .where(sql`${canonicalEmailSql(users.email)} = ${normalizedEmail}`)
    .limit(1);
  const existingUser = existingUsers[0];
  const seededAdmin = isBootstrapAdminEmail(existingUser?.email ?? normalizedEmail, env);

  return {
    allowed: Boolean(existingUser?.isApproved || seededAdmin),
    seededAdmin,
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
  }

  await db
    .update(users)
    .set(updates)
    .where(
      and(eq(users.id, input.userId), sql`${canonicalEmailSql(users.email)} = ${normalizedEmail}`),
    );
}
