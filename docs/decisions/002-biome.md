# ADR 002: Migrate from ESLint + TypeScript-ESLint to Biome

**Date:** 2026-02-22
**Status:** Accepted

## Context

The project was initially set up with ESLint v10 and `@typescript-eslint/eslint-plugin` for linting. During bootstrap we discovered that Next.js 16 removed the `next lint` CLI command, which forced us to use `eslint` directly and write a flat config manually. The setup works but carries several pain points:

- **Five packages** to maintain: `eslint`, `@eslint/eslintrc`, `eslint-config-next`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`
- **Flat config compatibility friction**: `eslint-config-next` uses the legacy config format; bridging it via `FlatCompat` caused circular serialisation errors in ESLint v10
- **No formatter**: ESLint only lints — formatting was not yet configured, meaning code style was enforced only by convention
- **Slow**: ESLint is JavaScript-based; parse + lint times grow noticeably on medium-sized codebases

## Decision

Replace ESLint and its satellite packages with **Biome** (`@biomejs/biome`).

Biome is an all-in-one toolchain written in Rust that provides:
- **Linting** (replaces ESLint + typescript-eslint)
- **Formatting** (replaces Prettier / unformatted state)
- **Import sorting** (replaces `eslint-plugin-import`)

A single `biome.json` file replaces `eslint.config.mjs`. A single `pnpm biome check src/` command replaces the separate lint and format steps in CI.

## Configuration choices

### Formatter

| Setting | Value | Reason |
|---|---|---|
| `indentStyle` | `space` | Matches Next.js scaffold default |
| `indentWidth` | `2` | Standard in the JS ecosystem |
| `lineWidth` | `100` | Wider than 80; pragmatic for TypeScript generics |
| `quoteStyle` | `single` | Consistent with existing codebase |
| `trailingCommas` | `all` | Matches TypeScript best practice; cleaner diffs |
| `semicolons` | `always` | Explicit; avoids ASI edge cases |

### Linter

Enabled rule sets:
- `recommended` — sensible baseline
- `correctness` — catches real bugs (unused variables, invalid regex, etc.)
- `suspicious` — flags dubious patterns
- `style` — enforces idiomatic TypeScript (prefer `const`, arrow functions, etc.)
- `performance` — flags patterns with known perf costs

Disabled:
- `nursery` — too unstable for a production codebase

### `organizeImports`

Enabled. Biome will sort imports deterministically. This removes an entire category of PR noise.

## Migration steps performed

1. Remove `eslint`, `@eslint/eslintrc`, `eslint-config-next`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`
2. Install `@biomejs/biome` as a dev dependency
3. Delete `eslint.config.mjs`
4. Create `biome.json` with the configuration above
5. Run `pnpm biome format --write src/` to apply formatting to all existing files
6. Run `pnpm biome check src/` to verify zero lint violations
7. Update `package.json` scripts:
   - `lint` → `biome check src/`
   - Add `format` → `biome format --write src/`
8. Update `.github/workflows/ci.yml` to use `pnpm lint` (no change needed — script alias already correct)

## Consequences

**Positive**
- Single tool, single config file, single command
- Dramatically faster: Biome's Rust core runs in tens of milliseconds vs hundreds for ESLint
- Formatting enforced in CI — no more "formatting" PR comments
- Import order deterministic across all contributors (and AI agents)
- Fewer `node_modules` entries — 5 packages removed, 1 added

**Negative / trade-offs**
- Biome does not yet cover every ESLint rule (notably, no `@next/next/no-img-element` equivalent — but we already use `next/image` throughout)
- Some nuanced TypeScript-ESLint rules (`no-floating-promises`, `await-thenable`) are not yet available in Biome — these are accepted as a gap for now; the domain layer's `Result` type pattern reduces reliance on promise discipline rules
- Biome's formatting is opinionated and may differ slightly from what team members have configured locally — run `pnpm format` to sync

## References

- [Biome docs](https://biomejs.dev)
- [Biome vs ESLint rule coverage](https://biomejs.dev/linter/rules/)
- [Biome migration guide from ESLint](https://biomejs.dev/guides/migrate-eslint-prettier/)
