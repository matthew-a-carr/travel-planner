# ADR 026: Searchable Organization Member Assignment from User Directory

**Date:** 2026-03-06
**Status:** Accepted

## Context

Organization owners currently add members by typing an exact email address.
That flow is error-prone and forces owners to guess which users already exist.

The app also has explicit signup/access controls (ADR 025), so this feature
must be clear about:

- who can see user identity data during member assignment
- whether non-signed-up users can be assigned
- whether this change alters signup policy

## Decision

Implement a searchable, existing-user-only member assignment flow in
`/settings/organization`.

1. Replace free-text email add with DB-backed user search + explicit selection.
2. Keep membership management authorization unchanged:
   - only organization owners can add/remove members
   - app admin does not override org ownership for member mutations
3. Search corpus is global signed-up users (`users` table), excluding users who
   are already members of the active organization.
4. Search matching is case-insensitive contains on email and display name.
5. Suggestions are capped at 20 and sorted alphabetically by display name with
   email fallback.
6. Search suggestions expose display name + full email to organization owners
   in this management context.
7. Keep signup policy unchanged:
   - no invite/pre-signup member assignment
   - no membership-based sign-in exception added in this feature

## Consequences

### Positive

- Owners can reliably find and add existing users without memorizing emails.
- Duplicate-add attempts drop because already-members are excluded in search.
- Access policy remains consistent with ADR 025 and ADR 021 (no hidden signup
  side effects).

### Negative / Trade-offs

- Full email visibility in suggestions increases PII exposure surface for org
  owners (intentional for usability in this admin-like context).
- Non-signed-up user assignment is still unsupported; invite workflow remains a
  future enhancement.
- Search now depends on additional query paths and UI state management.

## Alternatives considered

### Keep exact-email input only

Rejected: too much operator friction and frequent lookup errors.

### Add invite table and allow pre-signup membership

Rejected for now: out of scope and conflicts with the existing-user-only v1
constraint in ADR 021.

### Restrict search to approved users only

Rejected: member assignment should remain independent from approval/admin flags;
signup/access policy is still enforced separately at sign-in/runtime.
