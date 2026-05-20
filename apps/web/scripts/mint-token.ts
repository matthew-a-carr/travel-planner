/**
 * Dev-only CLI that mints a JWT access token for an existing user.
 *
 *   pnpm auth:mint-token --user-id <uuid>          # default 15min TTL
 *   pnpm auth:mint-token --email <email>           # resolved by canonical email
 *   pnpm auth:mint-token --email <email> --ttl 1h  # override TTL
 *
 * Output: the JWT on stdout, nothing else. Pipeable into curl:
 *   curl -H "Authorization: Bearer $(pnpm -s auth:mint-token --email …)" \
 *        http://localhost:3000/api/v1/me
 *
 * Refuses to run when NODE_ENV=production. Production tokens go through
 * the real PKCE flow (slice 3); minting a long-lived super-credential
 * with this CLI in production would be a serious security regression.
 */

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { normalizeEmail } from '@/infrastructure/auth/access-policy';
import { signAccessToken } from '@/infrastructure/auth/bearer-token';
import { users } from '@/infrastructure/db/schema';

type CliArgs = {
  userId?: string;
  email?: string;
  ttlSeconds?: number;
};

function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === '--user-id' && value) {
      args.userId = value;
      i++;
    } else if (flag === '--email' && value) {
      args.email = value;
      i++;
    } else if (flag === '--ttl' && value) {
      args.ttlSeconds = parseTtl(value);
      i++;
    } else if (flag === '--help' || flag === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${flag}`);
    }
  }
  if (!args.userId && !args.email) {
    throw new Error('Provide either --user-id <uuid> or --email <email>');
  }
  if (args.userId && args.email) {
    throw new Error('Provide --user-id OR --email, not both');
  }
  return args;
}

function parseTtl(value: string): number {
  const match = value.match(/^(\d+)([smhd])?$/);
  if (!match || !match[1]) throw new Error(`Invalid --ttl: ${value} (expected e.g. 15m, 1h, 3600)`);
  const amount = Number.parseInt(match[1], 10);
  const unit = match[2] ?? 's';
  const multiplier =
    unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : unit === 'd' ? 86_400 : 1;
  return amount * multiplier;
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

function printUsage(): void {
  console.error(`Usage:
  pnpm auth:mint-token --user-id <uuid> [--ttl 15m]
  pnpm auth:mint-token --email <email>  [--ttl 15m]

TTL accepts a bare number (seconds) or a suffix: s, m, h, d.
Default TTL is 15 minutes (matches production access-token TTL).

Refuses to run when NODE_ENV=production.`);
}

async function run(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('[auth:mint-token] Refusing to run in production. Use PKCE issuance instead.');
    process.exit(1);
  }

  let args: CliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[auth:mint-token] ${(error as Error).message}\n`);
    printUsage();
    process.exit(1);
  }

  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    console.error('[auth:mint-token] POSTGRES_URL environment variable is required');
    process.exit(1);
  }
  if (!process.env.AUTH_JWT_SIGNING_KEY) {
    console.error('[auth:mint-token] AUTH_JWT_SIGNING_KEY environment variable is required');
    process.exit(1);
  }

  const sqlClient = postgres(connectionString, { max: 1 });
  const db = drizzle(sqlClient);

  try {
    const userId = args.userId ?? (await resolveUserIdByEmail(db, args.email ?? ''));
    if (!userId) {
      console.error(`[auth:mint-token] No user found for the supplied identifier`);
      process.exit(1);
    }

    const jwt = await signAccessToken({ userId, ttlSeconds: args.ttlSeconds });
    process.stdout.write(`${jwt}\n`);
  } finally {
    await sqlClient.end();
  }
}

async function resolveUserIdByEmail(
  db: ReturnType<typeof drizzle>,
  email: string,
): Promise<string | null> {
  const normalised = normalizeEmail(email);
  if (!normalised) return null;
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${canonicalEmailSql(users.email)} = ${normalised}`)
    .limit(1);
  return rows[0]?.id ?? null;
}

run().catch((error) => {
  console.error('[auth:mint-token] Failed:', error);
  process.exit(1);
});
