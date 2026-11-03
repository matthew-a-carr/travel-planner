# ADR 072: Group Dependabot Security Updates

**Date:** 2026-11-03
**Status:** Accepted

## Context

ADR 068 groups routine version updates into minor/patch and major PRs. Groups
default to version updates, so security updates still opened individual PRs,
including two Next.js PRs where one omitted the workspace lockfile. The maintainer
requests grouped security fixes, separate from the engineering review PR.

The routine group also upgraded React DOM without React, breaking web unit tests
with a version mismatch. ADR 069 deliberately pins web and mobile to different
React versions and keeps the mobile test renderer on its compatible release line.

## Decision

- Add a group per ecosystem matching all packages with `applies-to: security-updates`.
  Keep ADR 068's separate minor/patch and major groups for routine updates.
- Hold `react-dom`, `@types/react-dom`, and `test-renderer` alongside the existing
  React/Expo holds. Upgrade these deliberately with their corresponding React
  versions and the existing web/mobile checks.
- Consolidate the current compatible security fixes in one PR from `main`,
  including the generated pnpm lockfile. This requested dependency batch is an
  exception to the usual 200–300 changed-line PR limit; keep handwritten changes
  small and list resolved versions and remaining advisories in the PR.
- Keep transitive security overrides within their existing compatible release
  lines. Declare the Agent SDK's MCP peer and Sentry's webpack peer explicitly
  so the lockfile resolves their required versions instead of retaining stale
  auto-installed peers. Incompatible fixes need deliberate parent upgrades.
- Enforce the security group and compatibility holds in the existing unit-test
  job through `apps/web/scripts/dependabot-config.test.ts`.

## Consequences

Future security updates are reviewed together per ecosystem instead of one PR per package.
Routine major updates remain separate so they cannot block routine minor/patch
updates. Existing compatibility holds still apply; grouping does not make an
unsupported major upgrade safe. Security PRs still require full verification,
and closing a superseded PR does not dismiss its security alerts.

GitHub documents the distinction in its
[security update configuration](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/configure-security-updates).
