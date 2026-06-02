# AGENTS.md

## Doc review — keeping docs true

| If you change…              | Check this doc               | What to verify                                            |
| --------------------------- | ---------------------------- | --------------------------------------------------------- |
| `src/features/**`           | `docs/features.md`           | Feature descriptions match current functionality          |
| `src/features/**`           | `CHANGELOG.md`               | User-facing changes have an entry under ## [Unreleased]   |
| `src/internal/**`           | `docs/internals.md`          | Internal architecture description is current              |

## Signs a doc is stale

- It describes a tool, file, command, or behaviour that no longer exists.
- It omits a key file or command that now does exist.
- Its prerequisites or setup steps no longer work end-to-end.
