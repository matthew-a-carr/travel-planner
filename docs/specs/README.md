# Feature Specifications

This directory contains feature specifications for the Travel Planner project.

New specs follow the template in [`_template.md`](./_template.md).
See [AGENTS.md](../../AGENTS.md) for the spec-driven development workflow and
[CONSTITUTION.md](../../CONSTITUTION.md) §3 for TDD rules.

Pre-spec draft briefs (produced by `plan-feature` after invoking the
`grill-me` skill — ADR 048) live alongside specs as `_draft-NNN-<slug>.md`
and are deleted (or renamed `.superseded.md`) once the SPEC is committed.
Per-spec rolling implementation notes live in
[`../implementation-notes/`](../implementation-notes/).

## Lifecycle

```
Draft → Approved → In Progress → Complete
                               → Abandoned (if cancelled)
```

- **Draft** — spec written, awaiting human review.
- **Approved** — human has reviewed and approved. Implementation may begin.
- **In Progress** — implementation underway.
- **Complete** — all acceptance criteria met, verification suite green,
  deviations logged.
- **Abandoned** — spec cancelled before or during implementation.

## Index

| Spec | Title | Parent | Date | Status |
|------|-------|--------|------|--------|
| [001](SPEC-001-rest-api-conventions-and-me.md) | REST API Conventions for v1 and `GET /api/v1/me` | [EPIC-001](../epics/EPIC-001-ios-app.md) | 2026-05-20 | Complete |
| [002](SPEC-002-bearer-token-auth.md) | Bearer-Token Auth Alongside Cookie Sessions + Mobile-Auth Model ADR | [EPIC-001](../epics/EPIC-001-ios-app.md) | 2026-05-20 | Complete |
| [003](SPEC-003-mobile-app-foundation.md) | Mobile App Foundation — Expo Skeleton + Testing Infra (merged slice 5 + 8) | [EPIC-001](../epics/EPIC-001-ios-app.md) | 2026-05-20 | Complete |
| [004](SPEC-004-mobile-oauth-endpoints.md) | Mobile OAuth Endpoints (`/api/v1/auth/mobile/*`) + refresh-token table + Postgres rate limit | [EPIC-001](../epics/EPIC-001-ios-app.md) | 2026-05-20 | Complete |
| [005](SPEC-005-shared-types-and-schemas.md) | Shared Wire Types and Schemas (`@travel-planner/shared`) | [EPIC-001](../epics/EPIC-001-ios-app.md) | 2026-05-20 | Complete |
| [006](SPEC-006-mobile-sign-in-pkce-keychain.md) | Mobile Sign-In UI + PKCE Flow + Keychain | [EPIC-001](../epics/EPIC-001-ios-app.md) | 2026-05-20 | Complete |
| [007](SPEC-007-api-response-envelope-and-openapi.md) | Standardised API Response Envelope + OpenAPI 3.1 YAML | — | 2026-05-21 | Draft |
