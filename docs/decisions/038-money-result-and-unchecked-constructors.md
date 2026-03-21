# ADR 038: Money Result and Unchecked Constructors

**Date:** 2026-03-21
**Status:** Accepted

## Context

The domain layer convention states "Fallible domain ops: `Result<T, E>` — no exceptions from domain"
(AGENTS.md). However, three domain functions threw exceptions instead of returning `Result`:

- `money()` — threw on non-integer pence
- `addMoney()` — threw on currency mismatch
- `calculateTotalSpend()` — threw on mixed currencies

This was inconsistent with every other domain function, which returns `Result<T>` for
validation failures. Callers had no compile-time signal that these functions could fail —
errors only surfaced at runtime as uncaught exceptions.

## Decision

### Two-tier Money constructors

1. **`money(amountPence, currency): Result<Money>`** — the validated constructor.
   Returns `err(...)` for non-integer pence. Used at system boundaries where user input
   is converted to Money (application use cases).

2. **`moneyUnchecked(amountPence, currency): Money`** — the trusted constructor.
   Returns `Money` directly with no validation. Used in contexts where pence are
   known-integer:
   - Domain arithmetic on existing Money values (sums, differences)
   - Infrastructure `toEntity()` mappers reading from the database
   - Test fixtures constructing seed data

The same pattern applies to `addMoney()` / `addMoneyUnchecked()` for currency mismatch
validation.

### `calculateTotalSpend()` returns `Result<Money>`

Mixed-currency spend entries are a domain error, not a programmer bug. The function now
returns `Result<Money>` and callers unwrap with fallback behaviour (typically `0` pence).

### Naming convention

The `Unchecked` suffix signals "caller asserts preconditions are met". This follows the
same principle as Rust's `unchecked` variants or Go's `Must` prefix — it communicates
trust explicitly so reviewers know validation is intentionally skipped.

## Consequences

- All domain functions now follow the `Result<T, E>` convention — no exceptions.
- Application use cases that receive user input validate via `money()` and propagate
  errors through the existing `Result` return chain.
- Infrastructure and domain-internal code uses `moneyUnchecked()` with no ceremony.
- New Money-constructing code must choose the appropriate variant:
  - User input → `money()` (safe)
  - Trusted arithmetic / DB values → `moneyUnchecked()` (direct)
- If a new validation rule is added to `money()` in the future, `moneyUnchecked()` will
  bypass it — this is intentional for performance and ergonomics in trusted contexts.
