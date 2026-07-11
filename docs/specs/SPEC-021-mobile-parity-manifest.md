# SPEC-021: Machine-Checked Mobile Parity Manifest

**Date:** 2026-07-11
**Status:** In Progress
**Author:** Codex
**Approved by:** Matt Carr, 2026-07-11 (full mobile parity instruction)
**Parent epic:** [EPIC-006 — Mobile-Web Capability Parity](../epics/EPIC-006-mobile-web-capability-parity.md)

## 1. Summary

Add a versioned manifest that inventories every shipped web product capability,
records its mobile and contract evidence, and validates those claims in CI. The
normal gate permits explicit migration states; a strict close-out gate fails
until every capability is complete.

## 2. Motivation

“Feature parity” is otherwise a judgement that drifts as the web application
changes. ADR 063 requires mechanical evidence: stable capability identifiers,
resolvable web/mobile/contract paths, honest status, and an inventory check that
catches a newly added numbered web E2E suite.

## 3. Acceptance criteria

1. `docs/mobile-parity.json` accounts for every numbered web E2E feature suite
   and groups the shipped surface into stable journey-level capability IDs.
2. `pnpm mobile:parity:check` rejects malformed entries, duplicate IDs, missing
   evidence, untracked numbered web suites, and false `complete` claims.
3. `pnpm mobile:parity:check:complete` additionally rejects every `missing` or
   `in_progress` capability and is the EPIC-006 close-out gate.
4. The validator has deterministic unit tests for its important failure modes
   and uses only Node standard-library APIs.
5. CI runs the normal validator on every change; the strict gate is documented
   but does not block incremental slices before the epic is complete.

## 4. Demo script

1. Run `pnpm mobile:parity:check` and see a summary of complete, in-progress,
   and missing capabilities.
2. Point a completed capability at a missing mobile evidence file and see the
   command fail.
3. Run `pnpm mobile:parity:check:complete` and see it list the remaining gap.

## 5. Out of scope

- Implementing any missing product capability.
- Parsing Playwright ASTs or requiring one manifest row per edge-case test.
- Recording/video diagnostics and one-command local backend orchestration;
  these remain EPIC-004 slice 4 work.

## 6. Design

The manifest contains a schema version, the numbered web feature suites used as
the baseline, and capability records with `id`, `title`, `slice`, `status`, and
web/mobile/contract evidence arrays. Evidence is repository-relative.

A dependency-free Node module exports the validation function and acts as the
CLI. It verifies shape, uniqueness, path existence, baseline coverage, and
status/evidence invariants. Numbered suites (`NN-*.spec.ts`) are treated as the
product-feature baseline; generic auth/accessibility suites may still be cited
as evidence but do not create accidental capability rows for presentation-only
checks.

`complete` requires web, mobile, and contract evidence. This epic has no
platform-only exceptions; introducing one requires an explicit design change.

## 7. Security & data considerations

The manifest contains paths and labels only. The validator does not execute
evidence files, follow external links, access the network, or read secrets.

## 8. Test plan

- Node unit tests: valid incremental manifest, strict-mode gap, duplicate IDs,
  missing evidence, false completion, and untracked numbered suite.
- Repository gate: validate the real manifest.
- Existing lint, type, unit, integration, web E2E, mobile E2E, and build gates
  remain unchanged except for invoking the new validator.

## 9. Rollback

Revert the manifest, validator, scripts, and CI invocation together. No runtime
or persisted data changes.

## 10. Implementation order

1. [ ] Write validator tests and observe RED because the module is absent.
2. [ ] Implement the smallest validator and make focused tests green.
3. [ ] Inventory the numbered web feature suites and record current evidence.
4. [ ] Wire normal/strict commands and the normal CI gate.
5. [ ] Run full relevant verification and update EPIC-006/docs.

## 11. ADR and tech debt

ADR 063 already owns the manifest decision; no new ADR is needed. The slice does
not close TD-010 and does not create a new dependency or runtime service.

## 12. Open questions

None. Journey-level grouping, numbered-suite baseline, and incremental versus
strict modes are settled by ADR 063 and EPIC-006.

---

## Implementation Deviations

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|

### Post-Implementation Notes

_Filled at close-out._
