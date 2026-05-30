# Feature Specifications

This directory contains feature specifications for the Travel Planner project.

New specs follow the template in [`_template.md`](./_template.md).
See [AGENTS.md](../../AGENTS.md) for the spec-driven development workflow and
[CONSTITUTION.md](../../CONSTITUTION.md) §3 for TDD rules.

Per ADR 057, SPECs are drafted by the `draft-spec` routine in response to a
GitHub issue labelled `claude:plan`. Pre-spec draft briefs from the previous
interactive flow no longer exist — the issue body itself is the input the
routine consumes. Per-spec rolling implementation notes live in
[`../implementation-notes/`](../implementation-notes/).

## Lifecycle

```
Issue opened (claude:plan)
  → draft-spec routine opens a spec PR → status: Draft (PR labelled claude:revise)
    → review comments + claude:revise-now → revise-spec routine pushes updates
      → merge spec PR with claude:implement → status: Approved (implicit)
        → implement-spec routine → status: In Progress
          → impl PR merged → status: Complete
                          → Abandoned (if cancelled)
```

- **Draft** — SPEC written by `draft-spec`, awaiting human review on the
  spec PR.
- **Approved** — spec PR merged with `claude:implement` (no separate status
  string in the SPEC body — the routine simply moves on).
- **In Progress** — `implement-spec` is running.
- **Complete** — all acceptance criteria met, verification suite green,
  deviations triaged.
- **Abandoned** — spec PR closed without merge, or impl PR closed.

## Index

| Spec | Title | Parent | Date | Status |
|------|-------|--------|------|--------|
| [001](SPEC-001-rest-api-conventions-and-me.md) | REST API Conventions for v1 and `GET /api/v1/me` | [EPIC-001](../epics/EPIC-001-ios-app.md) | 2026-05-20 | Complete |
| [002](SPEC-002-bearer-token-auth.md) | Bearer-Token Auth Alongside Cookie Sessions + Mobile-Auth Model ADR | [EPIC-001](../epics/EPIC-001-ios-app.md) | 2026-05-20 | Complete |
| [003](SPEC-003-mobile-app-foundation.md) | Mobile App Foundation — Expo Skeleton + Testing Infra (merged slice 5 + 8) | [EPIC-001](../epics/EPIC-001-ios-app.md) | 2026-05-20 | Complete |
| [004](SPEC-004-mobile-oauth-endpoints.md) | Mobile OAuth Endpoints (`/api/v1/auth/mobile/*`) + refresh-token table + Postgres rate limit | [EPIC-001](../epics/EPIC-001-ios-app.md) | 2026-05-20 | Complete |
| [005](SPEC-005-shared-types-and-schemas.md) | Shared Wire Types and Schemas (`@travel-planner/shared`) | [EPIC-001](../epics/EPIC-001-ios-app.md) | 2026-05-20 | Complete |
| [006](SPEC-006-mobile-sign-in-pkce-keychain.md) | Mobile Sign-In UI + PKCE Flow + Keychain | [EPIC-001](../epics/EPIC-001-ios-app.md) | 2026-05-20 | Complete |
| [007](SPEC-007-mobile-authenticated-me-and-signout.md) | Mobile Authenticated "Me" Screen + Sign-Out (milestone slice) | [EPIC-001](../epics/EPIC-001-ios-app.md) | 2026-05-22 | Complete |
| [008](SPEC-008-api-response-envelope-and-openapi.md) | Standardised API Response Envelope + OpenAPI 3.1 YAML | — | 2026-05-21 | Complete |
