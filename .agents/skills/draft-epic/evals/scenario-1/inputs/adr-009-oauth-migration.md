# ADR-009: OAuth 2.0 / OIDC Migration

**Status**: Accepted  
**Date**: 2026-03-01  
**Deciders**: CTO, Head of Engineering, Security Lead

## Context

Our current custom session-cookie auth does not support SSO or third-party integrations. We need a standards-based approach.

## Decision

Migrate to OAuth 2.0 with OIDC using Keycloak as the identity provider. PKCE flow for all SPA clients.

## Consequences

- All services must validate JWTs against the JWKS endpoint
- Existing sessions will be migrated during a coordinated cutover
- Cookie-based auth will be deprecated after migration

## Alternatives considered

- Auth0: rejected due to cost at scale
- Rolling own: rejected due to security risk
