# Domain Docs

How the engineering skills should learn this repo's domain language and read its
architectural decisions.

## Domain language lives in

[`CONSTITUTION.md`](../../CONSTITUTION.md) (the law) plus the root
[`AGENTS.md`](../../AGENTS.md) and the per-layer `AGENTS.md` files under `apps/web/src/`
(`domain/`, `application/`, `infrastructure/`, `ui/`). There is no `CONTEXT.md`
glossary — don't assume or create one. Conventions (money in pence,
`Result<T,E>`, naming) are in `AGENTS.md` §Conventions.

Use the vocabulary already in those files and the codebase; don't drift to synonyms.

## Architectural decisions live in

`docs/decisions/NNN-title.md`, indexed by [`docs/decisions/README.md`](../decisions/README.md).
Write new ADRs with the `write-adr` skill (CONSTITUTION §7 template) — it also
updates the index and any superseded ADR's status. Specs live in `docs/specs/`,
epics in `docs/epics/`. There is no `docs/adr/` directory.

If output contradicts an existing ADR, surface it explicitly rather than
silently overriding it.

## Layout

Single domain, pnpm monorepo (ADR 046). Decisions are repo-wide under
`docs/decisions/`.
