# Root AGENTS.md

## Doc review — keeping docs true

| If you change…           | Check this doc         | What to verify                          |
| ------------------------ | ---------------------- | --------------------------------------- |
| `packages/auth/src/**`   | `docs/auth.md`         | Auth flow description matches code      |
| `packages/api/src/**`    | `docs/api.md`          | API surface matches implementation      |

## Signs a doc is stale

- It describes a tool, file, command, or behaviour that no longer exists.
- It omits a key file or command that now does exist.
- Its prerequisites or setup steps no longer work end-to-end.
