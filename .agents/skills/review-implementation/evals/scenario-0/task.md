# Implementation PR Review: Payment Processing Feature

## Problem/Feature Description

Your team has been using a spec-driven development workflow where engineers implement features based on formal SPEC documents. A pull request implementing SPEC-042 (a new payment processing feature) has just been labelled `ai:done` and is waiting for review.

The diff adds a new domain service for processing refunds, a repository class, a server action, and supporting unit tests. However, the branch was submitted in a hurry and there are some concerns about code quality and completeness.

You have been given a set of files representing the current state of the repository (the diff contents, the SPEC, and the implementation notes). Your job is to perform a thorough implementation review and produce a structured report.

## Output Specification

Produce a file called `review-report.md` in your working directory containing your full review report.

The report should cover all relevant review dimensions: SPEC fidelity, architecture, naming conventions, tests, ADR obligations, documentation staleness, and simplicity.

Use the files provided in `inputs/` as the source material:
- `inputs/SPEC-042-refund-processing.md` — the SPEC document
- `inputs/impl-notes-042.md` — the implementation notes file
- `inputs/diff.patch` — the code changes being reviewed
