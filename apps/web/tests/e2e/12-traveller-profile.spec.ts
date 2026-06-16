import { readFile } from 'node:fs/promises';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { encode } from 'next-auth/jwt';
import { type BrowserContext, expect, test } from '@playwright/test';
import postgres from 'postgres';
import { users } from '../../src/infrastructure/db/schema';
import { E2E_POSTGRES_URL_FILE } from './setup/e2e-env';

const SESSION_COOKIE_NAME = 'authjs.session-token';
const E2E_DEFAULT_AUTH_SECRET = 'dev-only-not-a-real-secret';

type AuthUser = { readonly id: string; readonly email: string; readonly name: string };

async function withDatabase<T>(fn: (db: ReturnType<typeof drizzle>) => Promise<T>): Promise<T> {
  const connectionUri = (await readFile(E2E_POSTGRES_URL_FILE, 'utf8')).trim();
  const sqlClient = postgres(connectionUri, { max: 1 });
  const db = drizzle(sqlClient);
  try {
    return await fn(db);
  } finally {
    await sqlClient.end();
  }
}

async function ensureUser(email: string, name: string): Promise<AuthUser> {
  return withDatabase(async (db) => {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email.toLowerCase()}`)
      .limit(1);
    if (existing[0]) {
      await db.update(users).set({ dateOfBirth: null }).where(eq(users.id, existing[0].id));
      return { id: existing[0].id, email, name };
    }
    const id = crypto.randomUUID();
    await db.insert(users).values({
      id,
      name,
      firstName: name,
      lastName: null,
      email,
      isApproved: true,
      isAdmin: false,
      emailVerified: null,
      image: null,
    });
    return { id, email, name };
  });
}

async function signInAsUser(
  context: BrowserContext,
  baseURL: string | undefined,
  user: AuthUser,
): Promise<void> {
  const maxAgeSeconds = 30 * 24 * 60 * 60;
  const expires = Math.floor((Date.now() + maxAgeSeconds * 1000) / 1000);
  const secret = process.env.AUTH_SECRET ?? E2E_DEFAULT_AUTH_SECRET;
  const sessionToken = await encode({
    token: { sub: user.id, name: user.name, email: user.email, picture: null, isApproved: true },
    secret,
    salt: SESSION_COOKIE_NAME,
    maxAge: maxAgeSeconds,
  });
  const cookieBaseUrl = new URL(baseURL ?? 'http://localhost:3000');
  await context.clearCookies();
  await context.addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      url: cookieBaseUrl.origin,
      expires,
      httpOnly: true,
      secure: cookieBaseUrl.protocol === 'https:',
      sameSite: 'Lax',
    },
  ]);
}

test('a user can record their date of birth and a passport, and it persists', async ({
  page,
  context,
  baseURL,
}) => {
  const user = await ensureUser(`profile-${Date.now()}@travelplanner.test`, 'Profile Tester');
  await signInAsUser(context, baseURL, user);

  await page.goto('/settings/profile');
  await expect(page.getByRole('heading', { name: /traveller profile/i })).toBeVisible();

  await page.getByLabel('Date of birth').fill('1990-05-15');

  await page.getByRole('button', { name: /add passport/i }).click();
  const nationality = page.getByLabel('Nationality');
  await nationality.fill('United Kingdom');
  await page.getByRole('option', { name: 'United Kingdom', exact: true }).click();
  await page.getByLabel(/label/i).fill('UK passport');

  await page.getByRole('button', { name: /save profile/i }).click();
  await expect(page.getByText('Profile updated')).toBeVisible();

  // Reload — the saved profile is re-rendered from the database.
  await page.reload();
  await expect(page.getByLabel('Date of birth')).toHaveValue('1990-05-15');
  await expect(page.getByLabel('Nationality')).toHaveValue('United Kingdom');
});
