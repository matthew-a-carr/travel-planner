# ADR 039: Skip Per-PR Neon Preview Branches for Bot-Authored PRs

**Date:** 2026-05-09
**Status:** Accepted

## Context

The preview Terraform stack (`infra/stacks/preview`) provisions a dedicated
Neon branch, endpoint, role, database, and Vercel `POSTGRES_URL` env var for
every open PR. The set of PRs is supplied by `.github/workflows/infra-preview.yml`,
which queries `GET /repos/{repo}/pulls?state=open` and passes the full list as
`TF_VAR_open_previews`.

The Neon project (`travel-planner-preview`) runs on the free plan, which
caps a project at **10 branches** (parent included). With Dependabot grouping
all minor and patch updates into one PR per ecosystem (ADR 008) plus
release-please's release PR, there are routinely 10+ open bot PRs. Apply
fails with `[HTTP Code: 422][Error Code: BRANCHES_LIMIT_EXCEEDED]` and human
PRs get starved of preview databases.

Bot PRs do not benefit from a dedicated branch. Dependabot bumps versions and
release-please cuts releases — neither exercises schema migrations or
seeded data in a way that requires isolation from other previews.

## Decision

Filter bot-authored PRs out of `open_previews` at the workflow source. The
`gh api` jq expression now selects only PRs where `.user.type != "Bot"`,
which excludes both `dependabot[bot]` and the GitHub-Actions identity used
by release-please.

Filtered PRs still receive a Vercel preview deployment; they fall back to
the shared default `POSTGRES_URL` configured at
`infra/stacks/preview/main.tf:77-85`.

The workflow also gains a `concurrency: { group: infra-preview, cancel-in-progress: false }`
block so that two preview applies can't race on the same Terraform Cloud
workspace and Neon project.

If a bot PR genuinely needs an isolated branch (e.g. a major bump that
exercises schema), trigger the workflow manually via `workflow_dispatch`
with `open_previews_json` including that PR.

## Consequences

### Positive

- Free-plan branch budget is reserved for human-authored PRs.
- Apply stops failing with `BRANCHES_LIMIT_EXCEEDED` under normal Dependabot
  load.
- Concurrent runs serialise, eliminating a class of state races.

### Negative / Trade-offs

- Bot PR previews share one DB; a destructive migration in one such PR could
  affect another. Acceptable because migrations are gated on human review
  before merging.
- Manual override (`workflow_dispatch`) required for the rare bot PR that
  warrants isolation.

## Alternatives considered

- **Upgrade the Neon plan.** Solves the symptom but adds recurring cost for
  no functional benefit on bot PRs.
- **Cap `open_previews` to N most-recent PRs.** Brittle; can silently drop a
  human PR when bot PR volume spikes.
- **Filter by branch-name prefix (`dependabot/`, `release-please--`).**
  Equivalent today but coupled to current bot configuration; `user.type ==
  "Bot"` is the upstream-stable identifier.
