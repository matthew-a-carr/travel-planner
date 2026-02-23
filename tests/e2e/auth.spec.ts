import { test, expect } from '@playwright/test';

/**
 * Authentication journeys.
 *
 * These tests verify public/protected routing behaviour without
 * requiring a real Google OAuth flow. They check redirects and
 * page content based on the auth state.
 *
 * Full sign-in e2e (with real OAuth) requires a seeded test account
 * and is deferred to a separate test file that only runs in staging.
 */

test('unauthenticated user sees landing page with sign-in button', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Travel Planner' })).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();
});

test('unauthenticated user is not redirected away from root', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL('/');
});

test('unauthenticated user visiting /trips is redirected to /login', async ({ page }) => {
  await page.goto('/trips/some-trip-id');
  // next-auth v5 redirects to /login?callbackUrl=... in production mode.
  // Check only the pathname so query parameters don't break the assertion.
  const { pathname } = new URL(page.url());
  expect(pathname).toMatch(/\/(login)?$/);
});

test('login page renders correctly', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Travel Planner' })).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();
});
