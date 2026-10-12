# ADR 071: GitHub Actions Security Boundaries

**Date:** 2026-10-08
**Status:** Accepted

## Context

The repository's Actions workflows run dependency installation, tests, releases,
and Terraform. Mutable action tags made the executed code change without a
repository diff. Several workflows inherited token permissions from repository
settings. Preview dispatch input was interpolated directly into a shell script.

## Decision

Retain the Node.js 24 baseline established by ADR 069.

- Pin external actions and reusable workflows to full commit SHAs, retaining a
  version comment for reviewers. Dependabot continues managing updates (ADR 068).
- Declare `contents: read` as the workflow default. Grant `pull-requests: read`
  to the change detector and preview inventory job. Release Please retains its
  required `contents: write` and `pull-requests: write` permissions.
- Pass event payloads and manual dispatch input into shell steps through quoted
  environment variables. Validate the preview map as JSON and compact it before
  writing a single-line Actions output. Aggregate all API pages before computing
  the desired preview set. Use standalone `jq` after `gh api --paginate --slurp`
  (the CLI cannot combine `--slurp` with `--jq`) and enable `pipefail` so failed
  inventory requests stop the job before Terraform can plan deletions.
- Enforce these rules in `apps/web/scripts/workflow-security.test.ts`, run by the
  existing unit-test job. Shell regressions execute the inventory step with API
  fixtures using the workflow's existing Bash and `jq` tools. No new CI stage or
  dependency is required.

This follows P19 (least privilege), P21 (supply chain), and P14 (mechanical
enforcement), using GitHub's [secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use).

## Consequences

Action updates become reviewable diffs. Explicit token permissions remain stable
when repository defaults change. Dispatch strings cannot become shell syntax.
Tests prevent accidental regression, but do not replace action-code review or
validate the remote Terraform/secret configuration. Updating a major action
requires resolving and reviewing its new SHA as well as the version comment.
