# ADR 014: Development Local Auth Fallback

**Date:** 2026-03-01
**Status:** Accepted

## Context

Manual local feature testing depended on Google OAuth configuration. The project
already injects placeholder Google credentials during `pnpm dev`, but those
values do not support real sign-in. This created friction for day-to-day
testing because developers needed to configure a real Google app before they
could reach authenticated flows.

We need a local-only login path that is fast, safe, and does not affect
production authentication behavior.

## Decision

Add a dev-only Auth.js credentials provider (`local-dev`) that is enabled only
when `NODE_ENV=development`.

- The local provider performs one-click sign-in and provisions/reuses a stable
  user row in `users` (`local-dev@travel-planner.local`) so data ownership is
  consistent across sessions.
- Google provider remains available when `AUTH_GOOGLE_ID` and
  `AUTH_GOOGLE_SECRET` are configured with non-placeholder values.
- Placeholder credentials (e.g. `replace-with-*`, `dev-placeholder-*`) are
  treated as not configured, so broken Google buttons are hidden locally.
- Production never exposes the local-dev provider.
- Explicit `jwt` and `session` callbacks map token subject to `session.user.id`
  to keep server actions and ownership checks stable.

## Consequences

- Local manual testing of authenticated features works out-of-the-box with
  `pnpm dev`, without Google setup.
- Developers can still test real Google OAuth locally by providing real
  credentials, in which case both sign-in options are visible in development.
- Production auth surface stays Google-only and unchanged for end users.
- Sign-in UI/tests must account for provider availability rather than assuming a
  Google-only button in all environments.
