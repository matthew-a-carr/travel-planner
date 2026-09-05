# ADR 069: Node 24 and Dependency Test Migrations

**Date:** 2026-09-05
**Status:** Accepted

## Context

The consolidated Dependabot update includes AI SDK 7, React Native Testing
Library 14, Testcontainers 12.1, and Vitest 5. Their supported Node ranges
exclude the Node 20 runtime used by CI. React Native Testing Library 14
also requires async rendering and a replacement renderer.

## Decision

Use Node 24 for CI and web deployment, with the web package's `engines`
field declaring the supported deployment major. Local verification uses
Node 24 too. Keep the existing CI jobs and merge gates.

Use React Native Testing Library 14 with `test-renderer` 1.1, the line
matching mobile React 19.1. Await rendering and events, and explicitly
control pending requests when testing loading states. Retain
`react-test-renderer` 19.1 for the Expo 54 test preset. Declare the Expo
Router peers at SDK 54-compatible versions so a fresh install cannot
select newer SDK packages or the web app's React DOM version.

Adopt Vitest 5 with the existing Vite 7 hold; inline projects inherit the
root plugin configuration. Supply an empty context to direct AI SDK 7
tool invocations in tests. Existing application behavior remains covered
by the same assertions and real-database integration tests.

This is a one-time consolidation requested by the maintainer. It does not
change ADR 068's future Dependabot grouping or lift the Expo, TypeScript,
and Vite holds. Web React advances with React DOM; mobile React remains
at its SDK pin.

## Consequences

- Node 20 is no longer supported for development, CI, or web deployment.
- Mobile tests use the current renderer without requiring an Expo upgrade.
- Generated OpenAPI output is refreshed for Zod's equivalent nullable
  schema representation; the wire contract is unchanged.
- The consolidated update must pass local checks and every applicable CI
  gate before merge. A single revert rolls back the dependency migration.
