---
name: review-tech-debt
description: >
  Review and triage the tech debt register. Use when the user says "review tech
  debt," before planning a new feature, or on a periodic schedule. Reads
  docs/tech-debt.md, assesses each item's relevance and severity, categorises
  actions, and reports recommendations to the human.
---

# Review Tech Debt

## When to use

Use this skill when asked to review tech debt, or automatically before planning
any new feature spec. Also suitable for periodic (e.g. weekly) scheduled reviews.

## Read the register

1. Read `docs/tech-debt.md` — the Outstanding Items table.
2. For each item, read the source spec (`docs/specs/SPEC-NNN-...`) to understand
   the original context and deviation that created the debt.

## Assess each item

3. For each outstanding item, evaluate:
   - **Is it still relevant?** (Has the code changed since? Was it resolved incidentally?)
   - **What's the blast radius?** (Does it affect a single file, a feature, or a cross-cutting concern?)
   - **Is it getting worse?** (Will future features compound this debt?)
   - **Can it be resolved quickly?** (< 1 hour of work, or requires a full spec?)

4. Categorise each item:

   | Category | Action |
   |----------|--------|
   | **Resolved incidentally** | Move to Resolved Items table with explanation |
   | **Quick fix** (< 1 hour) | Propose fixing it directly, no spec needed |
   | **Needs a spec** | Recommend filing a `claude:plan` issue so the `draft-spec` routine drafts a spec |
   | **Accept and defer** | Document why it's acceptable to defer, update severity if needed |
   | **No longer relevant** | Move to Resolved Items with "no longer applicable" |

## Report to human

5. Present findings as a summary:
   - Items resolved or no longer relevant (cleanup)
   - Quick fixes that can be done now
   - Items that need their own spec (with priority recommendation)
   - Items to defer (with rationale)

6. **Ask the human** which items to act on.

7. For approved quick fixes: implement them directly, following the TDD workflow
   from CONSTITUTION.md §3 and the verification steps from the `implement-spec` skill.

8. For items needing a spec: file a `claude:plan` GitHub issue for each one
   (the `draft-spec` routine drafts the spec PR), or draft it directly via
   the `draft-spec` skill in an interactive session.

## Update the register

9. Update `docs/tech-debt.md`:
   - Move resolved items to the Resolved Items table.
   - Update severity or owner for deferred items.
   - Add any new items discovered during the review.
10. Commit: `docs: review and update tech debt register`
