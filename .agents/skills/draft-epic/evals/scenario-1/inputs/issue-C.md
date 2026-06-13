# Issue C: Migrate Authentication to OAuth 2.0

**Label**: ai:plan-epic  
**Number**: #203  
**Strategic ADR**: docs/adr/adr-009-oauth-migration.md

## Vision

Replace our custom session-cookie auth with a standards-compliant OAuth 2.0 / OIDC flow to support SSO, third-party integrations, and improved security posture.

## Scope

Complete replacement of the current auth system: new OAuth server, PKCE flows for SPAs, token refresh, SSO provider integration, migration of existing sessions.

## Rough slices

1. Everything — this is one big migration that needs to land atomically to avoid a split auth state during the transition period
