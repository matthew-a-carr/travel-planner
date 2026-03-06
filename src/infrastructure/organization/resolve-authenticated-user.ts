import { eq, sql } from 'drizzle-orm';
import { normalizeEmail } from '@/infrastructure/auth/access-policy';
import type { Db } from '@/infrastructure/db/client';
import { users } from '@/infrastructure/db/schema';

type AuthenticatedSessionUser = {
  readonly id: string | null | undefined;
  readonly email: string | null | undefined;
  readonly name: string | null | undefined;
};

function canonicalEmailSql(column: typeof users.email) {
  return sql<string>`
    case
      when lower(trim(${column})) like '%@gmail.com' or lower(trim(${column})) like '%@googlemail.com'
        then replace(split_part(split_part(lower(trim(${column})), '@', 1), '+', 1), '.', '') || '@gmail.com'
      else lower(trim(${column}))
    end
  `;
}

export async function resolveAuthenticatedUserId(
  db: Db,
  input: AuthenticatedSessionUser,
): Promise<string | null> {
  const sessionUserId = input.id ?? null;
  const normalizedEmail = normalizeEmail(input.email);

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
      .where(sql`${canonicalEmailSql(users.email)} = ${normalizedEmail}`)
      .limit(1);
    if (existingByEmail[0]) return existingByEmail[0].id;
  }

  return null;
}
