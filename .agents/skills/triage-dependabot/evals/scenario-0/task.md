# Triage a Batch of Open Dependabot PRs

## Problem/Feature Description

You are triaging open Dependabot PRs in a **Next.js + Expo (React Native)
monorepo**. This repo has specific, documented rules about which dependency
families may move via Dependabot and which are version-locked or on hold — apply
those rules. Do **not** fall back to a generic "merge if the checks are green"
heuristic; several families pass CI while breaking the build out of lockstep.

Open PRs:

- **#201** — `react-native` 0.81.5 → 0.82.0 (Dependabot labels it "minor"); CI mixed.
- **#202** — grouped `minor-and-patch` npm update, 12 packages, none of them
  React / React-Native / Expo / Jest; all required checks green; release notes
  show no breaking changes.
- **#203** — `typescript` 5.9 → 6.0 (major); CI green.
- **#204** — a grouped PR bundling an `expo-router` patch with two unrelated
  small-library patches; CI green.
- **#205** — `actions/checkout` v4 → v4.2 (github-actions, patch); CI green.

## Output Specification

Produce a single file `triage.md` containing a table with one row per PR and the
columns: `PR | Package(s) | Type | CI | Recommendation | Rule`. The
Recommendation must be one of Merge / Hold / Close / Escalate (or Split for a
group that must be broken up), and the Rule cell must cite the governing reason.
