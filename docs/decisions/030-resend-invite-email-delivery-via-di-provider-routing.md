# ADR 030: Resend Invite Email Delivery via DI Provider Routing

**Date:** 2026-03-07  
**Status:** Accepted

## Context

ADR 029 introduced closed auth with admin pre-provisioned onboarding, but invite
communication remained manual.

We now need application-managed invite delivery when users are added to app
access, while preserving:

- composition-root dependency wiring (ADR 028)
- safe local/preview/test behavior (no accidental outbound email)
- deterministic onboarding semantics (no duplicate invite sends from idempotent
  pre-provision operations)

## Decision

1. Introduce an `InviteEmailService` application port and inject it through the
   runtime DI container.
2. Add two infrastructure implementations:
   - `ResendEmailService` for `VERCEL_ENV=production` with configured
     `RESEND_API_KEY`
   - `LoggingEmailService` for all other environments (dev/preview/test)
3. Define invite email rendering in application code (subject + text + html) so
   template behavior is provider-agnostic.
4. Extend user pre-provision semantics to include approval transition metadata:
   - `approved_now`
   - `already_approved`
5. Trigger auto-invite only when transition is `approved_now`.
6. Add explicit admin-only resend invite action for retries/reminders.
7. Keep user pre-provision non-blocking on provider failure:
   - access provisioning still succeeds
   - failures surface as warnings and structured logs
8. Standardize sender identity:
   - `EMAIL_FROM_ADDRESS=hello@mail.matthewcarr.dev`
   - `EMAIL_FROM_NAME=Travel Planner`

## Consequences

### Positive

- Invite delivery is testable and swappable via DI.
- Production delivers real invites; non-production remains safe by default.
- Onboarding semantics stay idempotent and explicit.
- Operators gain structured send/failure logs and a manual resend path.

### Trade-offs

- Additional runtime/env configuration is required (`RESEND_API_KEY`,
  sender metadata).
- Invite delivery adds external provider dependency and operational monitoring
  responsibility.
