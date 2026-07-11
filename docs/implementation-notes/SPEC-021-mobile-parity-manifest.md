# Implementation Notes — SPEC-021 Mobile Parity Manifest

## 2026-07-11 — Baseline and validator

- Grouped the 14 numbered Playwright feature suites into 34 journey-level
  capabilities. Four existing mobile foundation capabilities have end-to-end
  evidence; 30 are recorded honestly as missing rather than inferred from
  partial component code.
- Kept the validator dependency-free and repository-relative. It checks stable
  IDs, statuses, evidence existence, numbered-suite inventory coverage, and
  false completion claims. Strict mode is separate so incremental migration can
  remain green while EPIC-006 close-out still has a hard zero-gap command.
- RED was the missing validator module. Six Node tests now cover valid
  incremental state, strict-mode gaps, duplicate IDs, absent evidence, false
  completion, and an untracked numbered web suite.
