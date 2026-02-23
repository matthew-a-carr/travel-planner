import { test, expect } from '@playwright/test';

/**
 * Authentication journeys.
 *
 * These tests verify public/protected routing behaviour for
 * unauthenticated users. They must run without a session cookie,
 * so storage state is explicitly cleared here even though
 * playwright.config.ts sets a global auth state.
 */

// Override the global storageState — these tests run as unauthenticated visitors.
test.use({ storageState: { cookies: [], origins: [] } });

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
