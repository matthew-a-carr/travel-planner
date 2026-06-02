# SPEC-042: Refund Processing

## §1 Summary

Add automated refund processing for completed bookings within 48 hours of booking creation.

## §2 Background

Customers frequently cancel bookings shortly after making them. Currently refunds are manual. This SPEC automates the refund domain logic.

## §3 Acceptance Criteria

- AC-1: A refund can be initiated for any booking in `CONFIRMED` status created within the last 48 hours
- AC-2: Refund amount is calculated as 100% of the original booking total
- AC-3: Refund is recorded in the database with status `PENDING`
- AC-4: The refund initiation endpoint returns HTTP 200 with a refund ID and status

## §4 Motivation

Manual refund processing is slow and error-prone.

## §5 Out of Scope

- Partial refunds
- Refunds for bookings older than 48 hours (return a clear error)
- Integration with payment gateway (handled by a later SPEC)

## §9 Tests

- Unit tests for the domain refund eligibility logic
- Integration test against real Postgres for the refund repository
- E2E test verifying the refund endpoint returns 200 with correct payload

## §12 Implementation Order

1. Add `RefundEligibilityService` domain service
2. Add `RefundRepository` interface in domain layer
3. Add `DrizzleRefundRepository` implementation in infrastructure layer
4. Add `InitiateRefundUseCase` in application layer
5. Wire up DI in `create-app-container.ts`
6. Add `/api/v1/refunds` POST endpoint (server action)
7. Add tests
