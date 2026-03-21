import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { drizzle } from 'drizzle-orm/postgres-js';
import { encode } from 'next-auth/jwt';
import postgres from 'postgres';
import { users } from '../../src/infrastructure/db/schema';
import { E2E_POSTGRES_URL_FILE } from './setup/e2e-env';

const SESSION_COOKIE_NAME = 'authjs.session-token';
const E2E_DEFAULT_AUTH_SECRET = 'dev-only-not-a-real-secret';
const FALLBACK_IMAGE_URL = 'https://lh3.googleusercontent.com/broken-avatar-image';

test('authenticated user falls back to initials when avatar image cannot be loaded', async ({
  page,
  context,
  baseURL,
}) => {
  const connectionUri = (await readFile(E2E_POSTGRES_URL_FILE, 'utf8')).trim();
  const sql = postgres(connectionUri, { max: 1 });
  const db = drizzle(sql);

  const userId = crypto.randomUUID();
  const userName = 'Fallback Avatar';
  const userEmail = `fallback-avatar-${userId}@travelplanner.test`;

  await db.insert(users).values({
    id: userId,
    name: userName,
    firstName: 'Fallback',
    lastName: 'Avatar',
    email: userEmail,
    isApproved: true,
    isAdmin: false,
    emailVerified: null,
    image: FALLBACK_IMAGE_URL,
  });
  await sql.end();

  const maxAgeSeconds = 30 * 24 * 60 * 60;
  const expires = Math.floor((Date.now() + maxAgeSeconds * 1000) / 1000);
  const secret = process.env.AUTH_SECRET ?? E2E_DEFAULT_AUTH_SECRET;
  const sessionToken = await encode({
    token: {
      sub: userId,
      name: userName,
      email: userEmail,
      picture: FALLBACK_IMAGE_URL,
      isApproved: true,
    },
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
      domain: cookieBaseUrl.hostname,
      path: '/',
      expires,
      httpOnly: true,
      secure: cookieBaseUrl.protocol === 'https:',
      sameSite: 'Lax',
    },
  ]);

  await page.route('**/_next/image*', async (route) => {
    const requestUrl = route.request().url();
    if (requestUrl.includes(encodeURIComponent(FALLBACK_IMAGE_URL))) {
      await route.abort('failed');
      return;
    }
    await route.continue();
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible();

  const initialsFallback = page.locator('header span[aria-hidden="true"]');
  await expect(initialsFallback).toContainText('FA');

  const brokenAvatarImage = page.locator(`header img[alt="${userName}"]`);
  await expect(brokenAvatarImage).toHaveCount(0);
});
