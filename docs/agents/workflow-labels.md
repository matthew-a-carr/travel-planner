# Workflow Labels

The autonomous lifecycle is label-driven (ADR 057): opening or merging an
issue/PR with a given label fires the matching routine. This repo is the
reference implementation of the `ai:*` vocabulary.

| Lifecycle role        | Label              | Fires / means                                |
| --------------------- | ------------------ | -------------------------------------------- |
| plan a SPEC           | `ai:plan`      | `draft-spec` — issue → SPEC PR               |
| plan an EPIC          | `ai:plan-epic` | `draft-epic` — issue → EPIC PR               |
| revise from feedback  | `ai:revise-now`| `revise-spec` — rewrite spec/epic PR         |
| implement             | `ai:implement` | `implement-spec` — merged spec PR → impl PR  |
| ready for review      | `ai:done`      | implementation PR awaiting human review      |
| blocked               | `ai:blocked`   | a routine hit a wall; Slack-DMs Matt         |
| already planned       | `ai:planned`   | issue already drafted; routine won't redo it |

The canonical description of the loop is in the root
[`AGENTS.md`](../../AGENTS.md) §Autonomous workflow and
[ADR 057](../decisions/057-autonomous-workflow-and-remote-execution.md).
