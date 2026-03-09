/**
 * Temporary Sentry verification endpoint.
 *
 * Throws a server-side error so you can confirm events arrive in the
 * correct Sentry project/environment. Remove or gate this route once
 * initial verification is complete.
 *
 * Usage:
 *   GET /api/sentry-example-api
 */
export function GET(): never {
  throw new Error('Sentry Example API Route Error');
}
