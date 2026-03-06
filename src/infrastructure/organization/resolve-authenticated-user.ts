import { eq, sql } from 'drizzle-orm';
import type { Db } from '@/infrastructure/db/client';
import { users } from '@/infrastructure/db/schema';

type AuthenticatedSessionUser = {
  readonly id: string | null | undefined;
  readonly email: string | null | undefined;
  readonly name: string | null | undefined;
};

export async function resolveAuthenticatedUserId(
  db: Db,
  input: AuthenticatedSessionUser,
): Promise<string | null> {
  const sessionUserId = input.id ?? null;
  const trimmedEmail = input.email?.trim() ?? null;
  const normalizedEmail = trimmedEmail?.toLowerCase() ?? null;

  if (sessionUserId) {
    const existingById = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, sessionUserId))
      .limit(1);
    if (existingById[0]) return existingById[0].id;
  }

  if (normalizedEmail) {
    const existingByEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(trim(${users.email})) = ${normalizedEmail}`)
      .limit(1);
    if (existingByEmail[0]) return existingByEmail[0].id;
  }

  if (!trimmedEmail) return null;
  return null;
}
