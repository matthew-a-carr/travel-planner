# EPIC-006: Mobile-Web Capability Parity

**Date:** 2026-07-11
**Status:** Approved
**Strategic ADR:** [063 — Mobile-Web Capability Parity over Shared v1 Contracts](../decisions/063-mobile-web-capability-parity-over-shared-v1-contracts.md)
**Owner:** Matt Carr
**Approved by:** Matt Carr, 2026-07-11 (instruction to complete the full mobile migration with 1:1 web feature parity)

> This epic turns the web application's shipped capability surface into an
> enforced mobile parity programme. “One-to-one” means the same authorised
> user outcome and persisted domain state, not identical component trees.

---

## 1. Vision

A traveller can leave the laptop closed. From the iPhone they can plan and
manage trips, destinations, budgets, fixed costs and spend; use the timeline,
assistant, profile and visa tools; manage the organizations and access their
role permits; and see the same answers that the web application shows. A
reviewer can start with deterministic data, complete every golden journey on
mobile, open the web application, and see the identical persisted result.

## 2. Why now

The mobile foundation and read paths shipped, but coverage stopped at the
signed-out screen and product scope deliberately stopped before general
editing. The web application has since added traveller profiles, visa
assessment, trip intent, timeline intelligence, and assistant journeys, so the
gap is widening. [ADR 063](../decisions/063-mobile-web-capability-parity-over-shared-v1-contracts.md)
changes the direction from staged mobile subsets to durable capability parity.

## 3. Definition of done

- [ ] A machine-checked parity manifest accounts for every user and admin
      capability evidenced by the web application.
- [ ] Every in-scope capability is marked `complete` with web, mobile,
      contract, and automated-test evidence; no undocumented exception exists.
- [ ] Every shared capability uses the same domain/application implementation
      through bearer-aware `/api/v1/*` endpoints and shared schemas.
- [ ] Every unsafe v1 operation is idempotent and has real-Postgres replay,
      authorisation, and tenant-isolation tests.
- [ ] Authenticated Maestro journeys run against the real backend and cover
      every golden mobile journey, including write/read-back on web.
- [ ] Mobile screens meet VoiceOver, Dynamic Type, dark-mode, and minimum
      44-point touch-target requirements with automated component checks.
- [ ] The full lint, migration, OpenAPI, type-check, unit, integration, web E2E,
      mobile E2E, and production-build gates pass with no skipped tests.
- [ ] EPIC-003, EPIC-004, TD-010, and all parity-related implementation notes
      are closed or explicitly superseded.

## 4. Demo script

1. Launch the E2E build, sign in through the gated browser-leg seam, and see
   the seeded trips list.
2. Create a trip, edit its plan and status, add/edit/remove destinations and
   fixed costs, then confirm the same plan on web.
3. Record, edit, and delete spend on mobile; see summaries, charts, and
   burndown update identically on both clients.
4. Paste an itinerary, review/apply the timeline, open the assistant and trip
   narrative, and confirm persisted history.
5. Record traveller profile and passport data, change trip intent, and see the
   same visa assessment and warnings as web.
6. Switch/create organizations and exercise membership/access operations as
   owner and admin; verify restricted roles cannot perform them.
7. Sign out, run the complete parity gate, and inspect the manifest: every
   capability is `complete` with resolvable evidence.

## 5. Outcome / success criteria

1. The parity gate reports zero missing or in-progress capabilities at epic
   close, and a deliberately removed evidence file makes it fail.
2. Every mobile mutation is visible through the web application without data
   translation or reconciliation.
3. Every web mutation is reflected by mobile refresh using the same v1
   contract and domain vocabulary.
4. No mobile module imports web delivery/UI code or duplicates a domain
   invariant; architecture tests enforce the boundary.
5. Authenticated mobile E2E is blocking and trustworthy: no unresolved
   deterministic failure and flake below EPIC-004's freeze threshold.

## 6. Non-goals

- Pixel-identical web and mobile layouts; platform-native presentation is
  required.
- Android, TestFlight/App Store distribution, offline-first sync, push
  notifications, or background work; these do not change capability parity on
  the existing iOS target.
- Automating the real Google consent screen; the double-gated E2E browser-leg
  seam remains the accepted boundary.
- Duplicating every Playwright edge case in Maestro; state/edge coverage stays
  lower in the test pyramid.

## 7. Vertical slices

| # | Slice | Demo script line(s) | Becomes SPEC | Depends on | Status |
|---|-------|---------------------|--------------|------------|--------|
| 1 | **Authenticated E2E unblock** — resolve TD-010 with a deterministic Simulator-to-backend route; sign-in → list/detail/not-found → sign-out journeys against the real backend. Completes EPIC-004 slice 3 | 1 | [SPEC-020 (Approved)](../specs/SPEC-020-mobile-authenticated-e2e-journeys.md) | EPIC-004 slices 1–2 | In progress |
| 2 | **Parity contract + E2E operations** — capability manifest and CI validator; failure recordings/backend and app network diagnostics; one-command local orchestration. Completes EPIC-004 slice 4 | 7 | [SPEC-021 (In Progress)](../specs/SPEC-021-mobile-parity-manifest.md) | 1 | In progress |
| 3 | **Trip planning core** — bearer v1 create/edit/delete/move trip and destination/fixed-cost CRUD; mobile native forms and role-aware actions | 2 | [SPEC-022 (trip CRUD, In Progress)](../specs/SPEC-022-mobile-trip-crud.md); [SPEC-023 (destination/fixed-cost CRUD, In Progress)](../specs/SPEC-023-mobile-destination-and-fixed-cost-crud.md) | 1, 2 | In progress |
| 4 | **Spend and financial insight** — idempotent spend create/edit/delete; summaries, category breakdown, alerts, charts, and burndown. Absorbs EPIC-003 | 3 | _not yet planned_ | 1–3 | Not started |
| 5 | **Timeline and trip intelligence** — paste/parse/apply itinerary, timeline insights, narrative, and assistant history/streaming through bearer-aware contracts | 4 | _not yet planned_ | 3 | Not started |
| 6 | **Traveller and visa journeys** — traveller profile/passports, trip intent, deterministic visa assessment, warnings, and persistence | 5 | _not yet planned_ | 3 | Not started |
| 7 | **Organizations and access administration** — switch/create organizations, membership management, approval/admin/pre-provision/delete operations with role parity | 6 | _not yet planned_ | 1–3 | Not started |
| 8 | **Parity closure and native quality gate** — remaining manifest gaps, VoiceOver/Dynamic Type/dark-mode audit, cross-client read-back journeys, docs and cost/flake review | 7 | _not yet planned_ | 3–7 | Not started |

> Each slice is specified lazily and implemented as tracer-bullet journeys.
> Slice 1 is a hard prerequisite: no product surface widens while the mobile
> E2E gate cannot exercise the real backend.

## 8. Sequencing rationale

The authenticated gate comes first because it proves every later slice can be
observed. The parity ledger and operational diagnostics then define the finish
line without mixing CI diagnosis into the first networking fix. Trip planning precedes
spend and intelligence because those journeys need mutable trips and
destinations. Traveller/visa and organization/access work can proceed in
either order after the core. The closure slice is intentionally last: it may
only close gaps revealed by evidence, not introduce a new foundation.

## 9. Kill / pivot criteria

- If the GitHub macOS simulator still cannot reach a runner-local backend after
  one focused slice testing hostname/ATS behavior with app-side error capture,
  pivot the E2E backend to an ephemeral HTTPS deployment while preserving the
  real Postgres, real Next.js, and gated-auth requirements; amend ADR 060.
- If median warm `mobile-e2e` runtime exceeds 15 minutes over 10 affected PRs,
  split read-only and mutating journey shards before adding more flows.
- If flake exceeds 1 in 5 `main` runs over two weeks, freeze new parity flows
  until the deterministic cause is removed; retries do not count as a fix.
- If a capability requires duplicating a domain invariant in mobile, stop that
  slice and expose/reuse the server use case instead.
- If the manifest grows beyond 60 independently exercised capabilities,
  regroup it by user journey while retaining stable capability IDs; do not
  turn Maestro into an inverted test pyramid.

## 10. Cross-cutting decisions

| Concern | Decision | Why |
|---------|----------|-----|
| Definition of parity | Same authorised user outcome, persisted state, calculations, and errors; native UI may differ | Preserves product parity without a false cross-framework abstraction |
| Source of truth | Web domain/application use cases remain canonical; both delivery surfaces adapt them | One implementation of invariants (P1/P2/P13) |
| Contracts | Shared zod schemas + generated OpenAPI for every v1 surface; expand/migrate/contract | Machine-readable, non-breaking boundaries (P11/P12/P14) |
| Writes | `Idempotency-Key` on every unsafe endpoint with durable replay | Mobile networks retry; duplicate mutations are correctness failures (P6/T3) |
| Parity ledger | Versioned machine-readable manifest with resolvable evidence paths and a blocking validator | “Keep parity” must be mechanical, not aspirational (P14) |
| Mobile architecture | Expo Router screens remain thin; feature hooks/clients in `src/`; no imports from web delivery/UI | Matches ADR 052 and keeps dependencies inward |
| E2E | One Maestro flow per golden journey against real server/Postgres; component/integration tests own branches | Risk-proportional test pyramid (P7) |
| Auth | Existing server-mediated PKCE and double-gated test browser leg until TD-004's trigger | Avoids relitigating ADR 051/060 inside parity slices |
| Accessibility | Native equivalents of WCAG intent: VoiceOver names/roles, Dynamic Type, contrast, dark mode, 44pt targets | P18 applies to both delivery surfaces |
| Roles | Admin/owner/member capabilities are all in scope; the same authorisation use cases gate both clients | Feature parity includes authorised administration, not only traveller reads |
| Observability | Existing server telemetry remains canonical; mobile errors carry request IDs and Sentry is revisited before release distribution | Cross-client diagnosis without a second backend telemetry model |

## 11. External dependencies & constraints

| Dependency | What we rely on | Constraint / status |
|------------|-----------------|---------------------|
| GitHub macOS runner + iOS Simulator | Release build and Maestro | TD-010 currently blocks authenticated networking; slice 1 owns the pivot decision |
| Expo SDK 54 | Current Expo Go-compatible runtime | TD-003 lockstep; no speculative SDK/library upgrades |
| Maestro | Golden mobile journey automation | Keep selectors on stable `testID`s and runtime inside §9 budgets |
| AI Gateway | Itinerary, timeline, narrative, assistant behavior | E2E uses deterministic unavailable/stubbed outcomes unless a stable test provider exists |
| Visa seed artifacts | Deterministic visa evaluation | Existing extraction remains offline; runtime mobile calls deterministic server use cases |

## 12. Cost & budget

| Item | Cost | When incurred | Decision |
|------|------|---------------|----------|
| GitHub macOS CI | Approximately 10× Linux minutes | Every mobile/shared-contract PR | Keep path-filtered; shard only at §9 trigger |
| Engineering | Eight vertical slices | Throughout | Accepted by the 2026-07-11 full-parity instruction |
| New vendors | £0 planned | — | Reuse existing stack; vendor addition requires an ADR |

## 13. Open questions

| # | Question | Owner | Answer by slice |
|---|----------|-------|-----------------|
| 1 | Does `http://localhost` with the current ATS local-network declaration work on the GitHub arm64 simulator, or must E2E pivot to ephemeral HTTPS? | Slice 1 | 1 |
| 2 | Should organization/access administration use one mobile settings hierarchy or separate owner/admin sections? | Matt / slice SPEC | 7 |
| 3 | Which chart primitives satisfy VoiceOver without adding a new native chart dependency? | Slice SPEC | 4 |
| 4 | Can assistant streaming reuse the v1 envelope/SSE conventions with bearer auth without a second client library? | Slice SPEC | 5 |

## 14. Parking lot

- Android parity after an Android target exists.
- Offline mutation queue and conflict resolution.
- TestFlight/App Store distribution, native OAuth, push, and Sentry source maps.
- Visual screenshot regression after functional/accessibility parity is green.

## 15. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| “Parity” expands whenever web changes | High | Epic never closes | Freeze manifest baseline per slice; new web capability must update the ledger |
| v1 surface duplicates server-action validation | Medium | Rule drift | Route integration tests call the existing use cases; architecture review blocks forks |
| Mobile E2E becomes slow/flaky | Medium | Gate loses trust | Golden journeys only, deterministic fixtures, §9 freeze/shard thresholds |
| Admin capability on a phone becomes cramped | Medium | Poor UX | Native settings hierarchy; behavioural rather than visual parity |
| Unsafe retries duplicate writes | Medium | Corrupt budgets/spend | Idempotency contract + real-Postgres replay tests before UI |
| Cross-client stale reads obscure parity | Low | False failures | Explicit refresh/read-back checkpoints and request IDs in journeys |

## 16. ADR triggers

| Slice | Likely ADR(s) | Notes |
|-------|---------------|-------|
| 1 | Amend ADR 060 only if runner-local backend pivots to HTTPS deployment | Hostname/ATS correction alone is implementation detail |
| 4 | Native chart library choice, only if built-in primitives are insufficient | New dependency requires an ADR |
| 5 | v1 assistant streaming contract, if existing conventions do not settle it | Contract shape may be cross-cutting |
| 8 | Distribution/observability ADR only if scope expands beyond Expo Go | Current epic does not fund App Store delivery |

## 17. References

- [ADR 063 — Mobile-Web Capability Parity](../decisions/063-mobile-web-capability-parity-over-shared-v1-contracts.md)
- [ADR 059 — Mobile Phase 3 Spend Capture](../decisions/059-mobile-phase-3-spend-capture-writes.md)
- [ADR 060 — Mobile E2E Real Backend](../decisions/060-mobile-e2e-real-backend-authenticated-journeys.md)
- [EPIC-003 — Mobile Spend Capture](./EPIC-003-mobile-spend-capture.md)
- [EPIC-004 — Authenticated Mobile E2E](./EPIC-004-mobile-e2e-authenticated-journeys.md)
- [TD-010](../tech-debt.md)

---

## Slice ledger (append-only)

| Date | Slice # | SPEC | Status change | Notes |
|------|---------|------|---------------|-------|
| 2026-07-11 | — | — | Approved | Full mobile migration and 1:1 web capability parity directed by Matt; strategic ADR and slice plan recorded before implementation. |
| 2026-07-11 | 1 | SPEC-020 | In progress | Authenticated real-backend journeys separated from the parity-ledger/diagnostics work to keep the networking fix independently reversible. |
| 2026-07-11 | 2 | SPEC-021 | In progress | Started the dependency-free capability manifest and CI validator while the authoritative SPEC-020 macOS run executes. Diagnostics/local orchestration remain later work in this slice. |
| 2026-07-11 | 3 | SPEC-022 | In progress | Split trip CRUD from destination/fixed-cost CRUD so the first atomic write contract, idempotency transaction boundary, native form, and write E2E remain one reviewable vertical slice. |
| 2026-07-11 | 3 | SPEC-023 | In progress | Reuse ADR 064 for the remaining trip-planning child resources and include stage guidance/budget suggestions so slice 3 closes without a UI-only follow-up. |

## Epic-level deviations

| # | Deviation | Reason | Impact on other slices | Resolved? |
|---|-----------|--------|------------------------|-----------|

## Post-epic notes

_Filled when the epic closes._
