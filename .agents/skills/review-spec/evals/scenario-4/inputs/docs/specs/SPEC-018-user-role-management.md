# SPEC-018 — User Role Management

**Status:** Draft
**Parent epic:** —

## §1 — Summary

Allow administrators to assign and revoke roles for users in their organization. Supports RBAC with predefined roles (Admin, Manager, Viewer).

## §2 — Background

Currently all users in an organization have the same permissions. Customers with larger teams need to delegate admin tasks to specific users without granting full admin access to everyone.

## §3 — Acceptance Criteria

1. An admin can assign one or more roles to a user.
2. An admin can revoke a role from a user.
3. Role changes take effect immediately (next request after assignment).
4. All role changes are recorded in the audit log.
5. A user cannot be left with zero roles (at least one role is always present).

## §4 — Demo Script

1. Log in as an organization admin.
2. Navigate to team management.
3. Assign "Manager" role to a team member.
4. Log in as that team member; confirm Manager permissions apply.
5. Revoke the "Manager" role; confirm revert to Viewer.
6. Attempt to remove all roles from a user; confirm system prevents it.

## §5 — Domain Model Changes

Add `UserRole` entity (userId, roleId, assignedAt, assignedBy) using UUID v4 identifiers per ADR-011. Soft-delete pattern (deactivatedAt) per ADR-020.

`assignRole(userId, roleId, actorId)` — returns `Result<UserRole, AssignRoleError>`.
`revokeRole(userId, roleId, actorId)` — returns `Result<void, RevokeRoleError>`. Rejects if user would have zero roles.

## §6 — API Changes

`POST /api/v1/users/{id}/roles` — assign role.
Success: `{ "data": { "userRoleId": "...", "role": "..." } }` (HTTP 201).
Error: `{ "error": { "code": "FORBIDDEN", "message": "..." } }` (HTTP 403) if actor lacks permission.

`DELETE /api/v1/users/{id}/roles/{roleId}` — revoke role.
Success: HTTP 204.
Error: `{ "error": { "code": "LAST_ROLE", "message": "Cannot remove last role" } }` (HTTP 422).

## §7 — Implementation Slices

1. Domain: `UserRole` entity, `assignRole`, `revokeRole` domain services.
2. Application: `AssignRoleUseCase`, `RevokeRoleUseCase`.
3. Infrastructure: `UserRoleRepository`, audit log integration.
4. Presentation: `POST` and `DELETE` handlers.

## §8 — Security

JWT middleware validates all endpoints. Only users with Admin role may call these endpoints (enforced in application layer). Role changes audit-logged per ADR-031.

## §9 — Test Plan

- Unit test `assignRole` and `revokeRole` domain services (including last-role guard).
- Integration test `AssignRoleUseCase` and `RevokeRoleUseCase` against test database.
- Integration test audit log writes on role change.
- E2E test the assign and revoke flows via API.

## §10 — Observability

Structured JSON log with correlation ID for every role assignment and revocation, per constitution.

## §11 — Rollback

Migration is additive (new `user_roles` table). Rollback: drop table and remove handlers. No data migration required.

## §12 — Implementation Steps

1. Add `UserRole` entity with `assignRole` and `revokeRole`. Verification: domain unit tests pass (`tests/domain/user-role.test.ts`).
2. Add `AssignRoleUseCase` and `RevokeRoleUseCase`. Verification: use case integration tests pass (`tests/use-cases/roles.test.ts`).
3. Add `UserRoleRepository` and audit log integration. Verification: repository integration tests pass (`tests/infrastructure/user-role-repo.test.ts`).
4. Add `POST /api/v1/users/{id}/roles` handler. Verification: E2E assign test passes (`tests/e2e/roles.test.ts`).
5. Add `DELETE /api/v1/users/{id}/roles/{roleId}` handler. Verification: E2E revoke test passes (`tests/e2e/roles.test.ts`).

## §13 — ADRs

- ADR-011 (UUID v4 identifiers): followed for `UserRole` entity.
- ADR-020 (soft delete): followed for role revocations.
- ADR-031 (audit log): followed — all role changes recorded.

No new ADRs required; this SPEC follows all existing decisions.

## §14 — Risks & Open Questions

- Role inheritance or hierarchical roles may be requested in the future; this implementation does not preclude that extension.
- Cache invalidation for role checks (if roles are cached in JWT claims) may require a token refresh; out of scope here.
