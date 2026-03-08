/**
 * Unit tests for the auth module.
 *
 * These tests verify the structural configuration of the auth module without
 * requiring a database connection or real OAuth credentials.
 *
 * The critical property under test: Google provider must be configured with
 * `allowDangerousEmailAccountLinking: true` so that pre-seeded (admin-created)
 * users can sign in with Google for the first time without hitting the
 * OAuthAccountNotLinked error.
 *
 * Background: Auth.js raises OAuthAccountNotLinked when it finds an existing
 * users row for an email but no corresponding accounts row linking that user
 * to the OAuth provider.  Admin-created users have no accounts row until their
 * first sign-in, so the flag is required for the invitation-based access model
 * this application uses.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const authIndexSource = readFileSync(
  fileURLToPath(new URL('./index.ts', import.meta.url)),
  'utf8',
);

describe('Google provider config', () => {
  it('enables allowDangerousEmailAccountLinking for the Google provider', () => {
    // Pre-seeded (admin-created) users have a users row but no accounts row.
    // Without this flag Auth.js throws OAuthAccountNotLinked on their first
    // Google sign-in.  Assert the flag is present in the source so a future
    // refactor cannot accidentally drop it.
    expect(authIndexSource).toContain('allowDangerousEmailAccountLinking: true');
  });
});
