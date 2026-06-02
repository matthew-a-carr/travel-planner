# SPEC-058: Checkout Flow

## Status: Implemented

## Summary
Integrate the new payment gateway for card processing.

## Deviation
The gateway timeout was hard-coded to 5 seconds during initial integration. Subsequent load testing showed that international transactions occasionally exceed this threshold causing false payment failures.

## Acceptance Criteria
- Payment gateway integrated and PCI-compliant
- Configurable timeout per payment method
- Retry logic on transient failures
