# Prepare a Fix for a Reviewed Bug and Document the Verification Plan

## Problem/Feature Description

A reviewer on PR #289 (`fix/order-totals-rounding`) caught a real bug: the `calculateOrderTotal` function silently truncates sub-cent values instead of rounding them, leading to off-by-one errors on orders with multiple discounts. The review comment includes a reproducing example. The PR also changes the `/api/v1/orders/total` endpoint response shape slightly — a field was renamed from `raw_total` to `rawTotal` to match the camelCase convention used everywhere else.

You need to plan and document exactly how you would address this feedback and bring the PR to a state ready to push. Produce a written plan rather than actually running the commands.

## Output Specification

Produce a file called `fix_plan.md` that describes, in order:

1. **Bug reproduction**: how you would confirm the bug exists before making changes, and what you would verify
2. **Code change**: what you would actually change in the production code (one or two sentences — keep it surgical)
3. **Verification commands**: the exact shell commands you would run locally before pushing, given that both application logic AND an API shape changed
4. **Commit message**: the exact commit message you would use, formatted correctly for automated changelog tooling
5. **What you would NOT do**: any tempting shortcuts you are explicitly ruling out and why
