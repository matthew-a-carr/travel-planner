# AGENTS.md

This file defines conventions and constraints for autonomous agents working in this repository.

## Repository structure

- `docs/epics/` — epic documents and README index
- `docs/adr/` — architecture decision records
- `docs/tech-debt.md` — current tech debt register
- `src/` — application source code
- `packages/` — shared packages

## Coding conventions

- TypeScript throughout
- All API endpoints must be validated with Zod schemas
- Database: PostgreSQL with Drizzle ORM
- Auth: JWT with RS256 signing

## Git conventions

- Branch naming: `claude/<type>-<slug>` for autonomous branches
- Commit message format: `<type>(<scope>): <description>`
- Never force-push to main or develop

## Tool conventions

- Use `git` for all local operations
- Use `mcp__github__*` tools for all GitHub remote operations (creating PRs, issues, labels, comments)
- Do NOT use `gh` CLI
