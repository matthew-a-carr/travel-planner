import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, sql } from 'drizzle-orm';
import postgres from 'postgres';
import { normalizeEmail, splitName } from '@/infrastructure/auth/access-policy';
import { users } from '@/infrastructure/db/schema';

function canonicalEmailSql(column: typeof users.email) {
  return sql<string>`
    case
      when lower(trim(${column})) like '%@gmail.com' or lower(trim(${column})) like '%@googlemail.com'
        then replace(split_part(split_part(lower(trim(${column})), '@', 1), '+', 1), '.', '') || '@gmail.com'
      else lower(trim(${column}))
    end
  `;
}

function parseArgs(argv: readonly string[]): { email: string; name: string | null } {
  const [email, ...rest] = argv;
  const name = rest.join(' ').trim();
  if (!email) {
    throw new Error('Usage: pnpm auth:bootstrap-admin -- <email> [optional name]');
  }

  return {
    email,
    name: name.length > 0 ? name : null,
  };
}

async function run(): Promise<void> {
  const { email, name } = parseArgs(process.argv.slice(2));
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('A valid email is required');
  }

  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('POSTGRES_URL environment variable is required');
  }

  const sqlClient = postgres(connectionString, { max: 1 });
  const db = drizzle(sqlClient);

  try {
    const existingRows = await db
      .select()
      .from(users)
      .where(sql`${canonicalEmailSql(users.email)} = ${normalizedEmail}`)
      .limit(1);

    const existing = existingRows[0];
    const now = new Date();

    if (existing) {
      const resolvedName = name ?? existing.name;
      const { firstName, lastName } = splitName(resolvedName);
      await db
        .update(users)
        .set({
          email: normalizedEmail,
          name: resolvedName,
          firstName,
          lastName,
          isApproved: true,
          isAdmin: true,
          updatedAt: now,
        })
        .where(eq(users.id, existing.id));

      console.log(
        `[auth:bootstrap-admin] Updated existing user ${existing.id} (${normalizedEmail}) as approved admin.`,
      );
      return;
    }

    const { firstName, lastName } = splitName(name);
    const inserted = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        name,
        firstName,
        lastName,
        isApproved: true,
        isAdmin: true,
        emailVerified: null,
        image: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: users.id });

    const user = inserted[0];
    if (!user) throw new Error('Failed to create admin user');
    console.log(
      `[auth:bootstrap-admin] Created approved admin user ${user.id} (${normalizedEmail}).`,
    );
  } finally {
    await sqlClient.end();
  }
}

run().catch((error) => {
  console.error('[auth:bootstrap-admin] Failed:', error);
  process.exit(1);
});
