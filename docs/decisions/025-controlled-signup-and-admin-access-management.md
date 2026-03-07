# ADR 025: Controlled Signup and Admin Access Management

**Date:** 2026-03-06
**Status:** Superseded by ADR 029

## Context

Production sign-in was effectively open to anyone who could complete Google OAuth.
Google OAuth Console user caps and testing-mode controls are not a reliable
product-access boundary for this app's scope and usage pattern.

The application needs an explicit in-app access policy that can:

- block unapproved sign-ins before user creation
- allow controlled future expansion without code rewrites
- support bootstrap and ongoing admin operations in the product UI
- revoke access quickly for already-authenticated users

## Decision

Adopt app-level access control in Auth.js + database-backed user access state:

1. Add signup policy env vars:
   - `AUTH_SELF_REGISTRATION_ENABLED` (`true`/`false`)
   - `AUTH_ADMIN_EMAILS` (comma-separated bootstrap admin emails)
2. Add user access fields on `users`:
   - `first_name`, `last_name`
   - `is_approved`, `is_admin`
3. Enforce access in `callbacks.signIn` before user creation:
   - self-registration ON: allow and auto-approve
   - self-registration OFF: allow only approved users or configured admin emails
4. Runtime bootstrap for configured admin emails:
   - allow configured admin emails immediately
   - sync `is_admin=true` and `is_approved=true` after sign-in
5. Enforce revocation on the next request:
   - app request context checks access policy on every authenticated request
   - revoked users lose app access without waiting for next sign-in
6. Add app admin UI at `/settings/access`:
   - list users + linked IdPs + organization memberships
   - approve/revoke access
   - grant/revoke app admin

## Consequences

### Positive

- Product access is controlled by application policy, not external OAuth console behavior.
- First-time access can be tightened or expanded by environment configuration.
- Admins can manage access directly in the app.
- Revocation takes effect quickly.

### Negative / Trade-offs

- More auth and authorization complexity in app code.
- Access now depends on correct env var governance and admin lifecycle management.
- Additional schema, tests, and operational docs are required.

## Alternatives considered

### Rely on Google OAuth Console restrictions only

Rejected: does not provide deterministic app-level authorization behavior for this product.

### Existing-user-only policy (manual DB seeding only)

Rejected: operationally awkward and no in-product management path.

### Always-open self-registration

Rejected: does not satisfy production restriction requirements.

### DB-only admin bootstrap (no env bootstrap list)

Rejected: creates first-admin bootstrapping risk and unnecessary manual setup coupling.
