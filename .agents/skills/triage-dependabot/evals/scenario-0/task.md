# Triage a Batch of Open Dependabot PRs

## Problem/Feature Description

You are triaging open Dependabot PRs in a **Next.js + Expo (React Native)
monorepo** with these hard-won, documented dependency rules:

- The **Expo-managed set** — `expo`/`expo-*`/`@expo/*`, `react-native` and
  `react-native-*`, `react`/`@types/react`, `jest`/`@types/jest` — is
  version-locked to the Expo SDK and moves **only** via a deliberate
  `expo install --fix` on an SDK bump, never via Dependabot. Dependabot
  mislabels React Native minors. Even a **patch** on this set can break SDK
  lockstep (this is the TD-009 mechanism that has timed out `mobile-e2e`).
- `typescript` major (→ 6.x) is on an **ecosystem-readiness hold** (TD-006);
  `vite` major (→ 8.x) likewise (TD-007).
- A grouped `minor-and-patch` npm PR or a `github-actions` minor/patch PR, with
  all required checks green and no breaking-change notes, is a safe merge
  candidate.
- The skill is **conservative**: it recommends; it does not merge/close without
  an explicit instruction.

Open PRs:

- **#201** — `react-native` 0.81.5 → 0.82.0 (Dependabot labels it "minor"); CI mixed.
- **#202** — grouped `minor-and-patch` npm update, 12 packages, none in the
  Expo-managed set; all required checks green; release notes show no breaking changes.
- **#203** — `typescript` 5.9 → 6.0 (major); CI green.
- **#204** — a grouped PR bundling an `expo-router` patch with two unrelated
  small-library patches; CI green.
- **#205** — `actions/checkout` v4 → v4.2 (github-actions, patch); CI green.

## Output Specification

Produce a single file `triage.md` containing a table with one row per PR and the
columns: `PR | Package(s) | Type | CI | Recommendation | Rule`. The
Recommendation must be one of Merge / Hold / Close / Escalate (or Split for a
group that must be broken up), and the Rule cell must cite the governing reason.
