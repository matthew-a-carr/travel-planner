# ADR 031: Soft Delete User with Anonymization

**Date:** 2026-03-07
**Status:** Accepted

## Context

We need the ability for admins to remove users from the system. However, hard-deleting users is unsafe because `organizations.createdByUserId` and `trips.ownerId` have `ON DELETE CASCADE` constraints. Deleting a user row would cascade-destroy organizations, trips, destinations, and spend entries belonging to all members of those organizations.

## Decision

Implement soft delete via anonymization:

1. **Anonymize PII** on the user row: replace name, email, and image with placeholder values while retaining the row and its UUID.
2. **Revoke access**: set `isApproved` and `isAdmin` to `false`, clear `emailVerified`.
3. **Remove associations**: delete all `accounts` (OAuth links), `sessions`, and `organizationMemberships` for the user.
4. **Retain FK targets**: do NOT delete from `organizations` or `trips` -- the `createdByUserId` and `ownerId` foreign keys continue to reference the anonymized user row.
5. **Sole-owner blocking**: deletion is blocked if the user is the sole owner of any organization. Ownership must be transferred first.
6. **Query filtering**: `listAll()` and `searchMemberCandidates()` exclude users whose email matches `deleted-*@anonymized.local`.

## Consequences

- Organization and trip data is preserved for all other members after a user is deleted.
- The anonymized user row occupies minimal storage and contains no PII.
- Admins must transfer organization ownership before deleting a sole owner.
- The email pattern `deleted-{userId}@anonymized.local` is unique per user (since userId is unique) and serves as a reliable filter predicate.
