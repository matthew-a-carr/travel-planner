# AGENTS.md

## Doc review — keeping docs true

| If you change…                        | Check this doc                     | What to verify                                                      |
| ------------------------------------- | ---------------------------------- | ------------------------------------------------------------------- |
| `docs/decisions/*.md`                 | `docs/decisions/README.md`         | Index row exists for the ADR, superseded ADR status lines updated   |
| `src/**`                              | `docs/architecture.md`             | Architecture description matches current code                       |

## Signs a doc is stale

- It describes a tool, file, command, or behaviour that no longer exists.
- It omits a key file or command that now does exist.
- Its prerequisites or setup steps no longer work end-to-end.
