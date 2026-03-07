# ADR 029: Closed Auth with Admin Pre-Provisioned Membership

**Date:** 2026-03-07  
**Status:** Accepted

## Context

The previous access model combined database state with environment-driven
signup controls (`AUTH_SELF_REGISTRATION_ENABLED`, `AUTH_ADMIN_EMAILS`) and
auto-created personal workspaces on first sign-in.

That created unnecessary complexity:

- access policy depended on deployment-time env governance
- first-login behavior mixed identity verification with organization lifecycle
- member assignment and user provisioning were not explicit operational steps

The product requirement is now closed-by-default access with admin-managed
onboarding, without email invite delivery in this phase.

## Decision

1. Remove env-based signup and admin allowlist controls.
   - Access is DB-driven only: user must exist and be approved.
2. Keep Google SSO as the production identity provider.
   - Unknown users are denied at sign-in (`AccessDenied`).
3. Remove first-sign-in personal workspace bootstrap.
   - No organization is created automatically during auth or request context.
4. Add explicit no-membership state.
   - Approved users without memberships are routed to `/settings/organizations`.
5. Make organization creation admin-only.
6. Add admin pre-provision flow in app settings.
   - Admins can create/approve users by email before first sign-in.
   - Organization assignment remains a separate action.
7. Keep local-dev credentials for development/preview edge cases.
   - Local-dev user is auto-provisioned as approved admin.
8. Add operational bootstrap command for first admin per environment:
   - `pnpm auth:bootstrap-admin -- <email> [name]`
9. Run one-time data backfill:
   - approve existing users that already have organization memberships (and admins).

## Consequences

### Positive

- Access control is deterministic and fully application-owned.
- Onboarding is explicit: provision user, then assign organization membership.
- Organization lifecycle is decoupled from authentication side effects.
- Runtime policy is simpler and easier to test.

### Trade-offs

- Requires an initial admin bootstrap step per environment.
- No email invite delivery yet; onboarding remains manual.
- Admins must pre-provision users before their first sign-in.

