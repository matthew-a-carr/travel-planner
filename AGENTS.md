# AGENTS.md — Travel Planner Constitution

## Architecture

This project follows DDD-inspired layered architecture. See `docs/architecture.md` for the full overview.

### Layer Dependency Rules
- `src/domain/` → ZERO external imports. Pure TypeScript only. No Next.js, no Drizzle, no framework code.
- `src/application/` → May import from `domain/` only.
- `src/infrastructure/` → May import from `domain/` and `application/`.
- `src/ui/` → May import from any layer.

Violations of these rules will break the structural tests.

### Testing
- Domain logic MUST have unit tests (Vitest). Test behaviour, not implementation.
- Write tests FIRST or alongside implementation, never after.
- Use descriptive test names: `it('should reject allocation exceeding available budget')`
- No mocking of domain objects. Mock only infrastructure boundaries.

### Code Style
- TypeScript strict mode. No `any` types.
- Prefer value objects over primitives for domain concepts (Money, Currency, DateRange).
- Use Result types for operations that can fail — no throwing exceptions from domain logic.
- Prefer named exports.
- File names: kebab-case (e.g., `spend-entry.ts`)

### Naming
- Domain entities: PascalCase (`Trip`, `Destination`)
- Value objects: PascalCase (`Money`, `BudgetAllocation`)
- Use cases: camelCase verb phrases (`createTrip`, `recordSpend`)
- Database tables: snake_case (`spend_entries`)
- React components: PascalCase (`BudgetSummary.tsx`)

### Commits
- Small, focused commits with clear messages
- Format: `feat: add destination budget allocation`
- Prefix: feat, fix, refactor, test, docs, chore

### Design System (Placeholder)
- Use Tailwind CSS utility classes
- Colour palette and component patterns TBD — keep styling minimal and clean for now
- Use shadcn/ui components where appropriate — install as needed
