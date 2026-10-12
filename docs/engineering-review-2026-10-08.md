# Repository engineering review — 2026-10-08

Original base: `0c02d2c` on `main`. Updated on 2026-10-12 with `main` at
`2d8e79c` (dependency/test-tooling migration #200 and trip-loading changes #201).
Work branch: `fix/engineering-standards-review`.

## Scope and approach

Reviewed the monorepo against its constitution, applicable ADRs, and the shared
engineering principles. Coverage included web and mobile delivery, shared wire
contracts, domain/application boundaries, authentication, database repositories,
AI/email adapters, migrations, CI, Terraform, tests, and operational documentation.
This combined repository-wide inventory and automated checks with targeted source
inspection of higher-risk paths; it is not a claim that every line was manually
audited or that the application has no remaining vulnerabilities.

The existing Next.js/Expo/Postgres architecture was retained. The changes below
repair reproducible defects and strengthen existing boundaries. Product features,
native SDK migrations, and transaction/AI-consent redesigns remain separate work.

## Implemented findings

| Priority | Finding and correction | Evidence |
|---|---|---|
| High | Google sign-in accepted absent/unknown email-verification claims. Web and mobile now require an explicit verified value. | Auth regression tests cover absent, false, malformed, and accepted claims. |
| High | Bearer verification accepted correctly signed tokens without expiration/issuance claims. Require `sub`, `iat`, and `exp`. | Signed-token negative tests, alongside existing issuer/algorithm/expiry tests. |
| High | Existing cookie/bearer credentials retained v1 resource access after approval was revoked. Shared auth now checks current approval; `/me` explicitly preserves account-status access. | Real-Postgres tests revoke approval after credential issuance and assert GET/POST return 403. OpenAPI regenerated. |
| High | Mobile auth state and code consumption used read-then-unconditional-update, allowing concurrent redemption. Conditional updates now claim only unconsumed, unexpired records; callers check the result. | Concurrent code redemption reproduced before the fix; repository races and expiry-boundary tests now pass. |
| High | Refresh-token reuse detection released locks before revocation; sign-out could miss a rotated successor. Lock and revoke every forward link within one transaction. | Replay, stale-token sign-out, and concurrent successor-rotation tests reproduced the gap and pass after the fix. |
| High | Vulnerable web authentication/framework versions and compatible transitives were installed. Updated Next.js to 16.3.8, Auth.js to beta.32, its Drizzle adapter to 1.11.3, and affected compatible transitives. | Production audit initially fell from 122 reports to 16; after integrating #200 and refreshing compatible transitives, 7 remain. Details below. |
| Medium | Google network calls had no explicit deadline; mobile deadlines stopped at response headers. Google now has a 15-second deadline; mobile keeps its existing deadline through body consumption. | Aborted-header/body tests and successful-response timer cleanup. |
| Medium | Country selection duplicated parent state and retained delayed blur callbacks. After save-and-add-another, the previous country stayed visible and a quick new search could disappear. Keep only the active query locally and reset it immediately on blur. | Existing browser journey reproduced the timeout; an added empty-country assertion failed with Japan before the fix. The complete browser suite passes after the fix. |
| Medium | Import guards missed relative/dynamic/re-export forms and allowed an AI SDK type to cross into application code. Parse imports with the existing TypeScript compiler and resolve layer paths; use the existing domain chat part type. | Negative guard fixtures, architecture tests, and full type check. The documented type-only shared-wire exception is retained. |
| Medium | Actions used movable tags and inherited token scopes; preview input could become shell syntax, and paginated inventory could emit multiple maps. Pin action SHAs, declare permissions, pass input through environment variables, aggregate pages, and validate/compact JSON. | Sixteen workflow security checks; shell smoke with quotes, command substitution, newlines, and invalid JSON values. ADR 071 records the standard. |
| Medium | CI used end-of-life Node.js 20 at the original review base. Upstream #200 now establishes Node.js 24 and resolves the mobile peer warnings; this branch preserves that migration. | ADR 069; clean frozen installation on Node.js 24. Hosted/native CI remains a merge gate. |

The package upgrades address published advisories; an installed vulnerable version
does not by itself prove a reachable exploit. For example, the
[Next.js advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j)
requires attacker-controlled SVG input to Node `ImageResponse`. The
[Auth.js configuration-error advisory](https://github.com/nextauthjs/next-auth/security/advisories/GHSA-8fpg-xm3f-6cx3)
is fixed in beta.32.

## Dependency audit

`pnpm audit --prod --json`, 2026-10-08. These are the registry's report counts,
including mobile tooling declared in production dependency trees, not a count of
exploitable application endpoints.

| Severity | Before | After |
|---|---:|---:|
| Critical | 8 | 0 |
| High | 71 | 4 |
| Moderate | 38 | 11 |
| Low | 5 | 1 |
| Total | 122 | 16 |

After integrating `main` on **2026-10-12**, the fresh audit reports **7 findings:
0 critical, 4 high, 3 moderate, 0 low**. Compatible transitive updates include
`sharp` 0.35.5, which addresses the upstream
[librsvg advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w).
The upstream dependency migration also removed the Sentry/OpenTelemetry and
AI SDK provider-utility reports from the production graph.

The audit still exits nonzero. Remaining high reports are two `image-size`
advisories through Expo/Metro (the fix crosses the installed major), `node-forge`
through Expo CLI, and `braces` through Metro's file matcher. The latter two have
no patched version reported by the registry. The moderate reports are Expo's
`uuid`/`decode-uri-component` and test-tooling `sprintf-js`. Do not force
incompatible overrides to make the count zero. Track these in TD-011 and validate
native changes through the existing SDK upgrade and Maestro gates.

## Remaining findings and required follow-up

| Priority | Evidence / limitation | Recommended next work |
|---|---|---|
| High | `infrastructure/ai/chat-tools.ts` accepts model-supplied `confirmed: true`; `ToolCallCard.tsx` sends plain confirmation text. No server-owned approval record binds the actor, arguments, and pending operation. This is a design finding, not a demonstrated external exploit. | TD-012: design a server-validated approval transition and tests for model-forged/replayed consent before widening AI mutation access. |
| Medium | `create-trip-with-destinations.ts` compensates only a returned validation failure, not a thrown repository failure. `add-destination.ts` validates shared budget state before a separate save; distinct idempotency keys do not serialize the trip aggregate. Concurrency impact is inferred from source, not reproduced in this pass. | TD-013: transaction-scoped use cases and an aggregate lock/serializable policy across web, v1, and chat, with failure-injection and concurrent-budget tests. |
| Medium | AI/email adapters and the database client do not establish application-owned operation deadlines. Provider defaults are not a documented service budget. | TD-014: define deadlines/cancellation at each boundary and test stalled upstream calls, preserving safe retry semantics. |
| Low | The Maestro installer in CI is still fetched as a mutable shell script. Action SHA pins do not cover downloaded tools. | TD-016: pin and verify the installer/tool release, following the existing cloudflared checksum pattern. |

Other observations: the mobile parity ledger reports **20 complete, 14 missing**;
that remains an incomplete rollout rather than a complete-parity claim. Chat
confirmation buttons use compact padding and need a measured check against the
project's 44px touch-target requirement. An obsolete root-level
`tests/e2e/fixtures/auth-state.json` is tracked (expired localhost cookie); the
active harness writes under `apps/web/`. Neither its value nor real credentials
are reproduced here. The linter excludes web unit tests and scripts; broader
format enforcement should be a deliberate, separate cleanup.

Production settings, secret rotation, branch protection, hosted CI, physical-iOS
behavior, and external provider availability were not changed or certified.
No production deploy or manual Terraform apply was performed. The follow-up request on
2026-10-12 authorizes publishing this review branch as a PR.

## Verification — updated 2026-10-12

Final checks use Node.js 24.20.0 and pnpm 10.34.5 after integrating `main`.

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` | Passed; no peer-dependency warnings. |
| `pnpm lint` | Passed; 427 files. One existing optional-chain warning in the chat route. |
| `pnpm type-check` | Passed for all three packages. |
| `pnpm test:unit` | Passed: shared 82, web 549, mobile 158, plus 14 mobile script checks (803 total). No skips. |
| `pnpm test:integration` | Passed: 394 tests across 75 files, real Testcontainers PostgreSQL. |
| `POSTGRES_URL=postgresql://build:build@localhost:5432/build pnpm build` | Passed with Next.js 16.3.8; existing Sentry config-import deprecation warning. |
| Migration policy, OpenAPI and visa-schema drift | Passed. |
| Mobile parity manifest | Passed incremental validation; 20 complete, 14 missing. Country-reset evidence note updated. |
| `terraform fmt -check -recursive infra` | Passed. No manual apply or remote-state changes. |
| Workflow input smoke | Passed: shell payload stays data, multiline JSON is compact, non-string map values fail. |
| Production dependency audit | **Not clean**: 7 reports remain (4 high, 3 moderate); see TD-011. |
| `pnpm test:e2e:web` | Passed: 85 tests in 44.7 seconds, with one existing development-only sign-in test skipped under the production server. |
| Native Maestro / hosted CI / production smoke | Not run locally on this branch. Hosted CI, including Maestro, remains a merge gate; production smoke belongs after deployment. |

Earlier runs on 2026-10-08 suffered documented host-sleep interruptions; those
results were not treated as passing. The first uninterrupted full run on
2026-10-12 found the country-field defect (84 passed, 1 failed, 1 existing skip).
A focused regression reproduced stale `Japan` text after reset. After the fix,
lint, types, unit tests, production build, parity validation, and the complete
browser suite were rerun successfully. No timeouts or assertions were weakened,
and no new skips were added. Browser logs still include navigation stream-close
messages; the final user-journey and accessibility assertions pass.

Local verification logs (temporary, not committed):
`/tmp/travel-pr-final-verification-2026-10-12.log`,
`/tmp/travel-pr-country-red.log`, and `/tmp/travel-pr-country-green.log`.
Test traces contain session data and stay within the normal private artifact
boundary. All changes are recorded in signed logical commits, with an explicit
merge retaining upstream dependency/tooling and performance work.

## Architecture review

Must-check dispositions from the `architecture-review` skill:

- **P15 — Conventional Commits: aligned** for the commits created so far.
- **P17 — Small commits: aligned**: fixes are separated into auth validation,
  mobile deadlines, architecture guards, approval checks, credential atomicity,
  dependencies, CI, the country-field regression, and review documentation. The merge retains upstream work.
- **P3 — Small slice: concern**: this is an explicitly requested repository-wide
  review spanning several surfaces. Review the auth, dependency, and CI groups
  separately before merging; it is larger than an ordinary feature slice.
- **P4 — Root cause: aligned**: fixes address claim validation, stale approval,
  atomicity, timeout lifetime, controlled form state, and missing enforcement. No temporary mitigations
  or remove-by exceptions were introduced.
- **P7 — Tests: enforced** by unit/architecture, real-Postgres integration,
  contract-drift, and web Playwright gates. Auth, workflow, and country-reset
  regressions were demonstrated failing before their fixes. Local checks pass;
  the existing development-only browser skip and pending native/hosted CI are
  recorded explicitly above.
- **P31 — Trunk-based: aligned**: isolated review branch off `main`; nothing
  deployed or merged to `main`, and no unfinished product feature was introduced.
- **P33 — Review etiquette: aligned**: findings distinguish reproduced defects,
  source-based inferences, and optional follow-up, with concrete evidence.

Relevant checks: P2/P14 enforced by architecture and workflow unit tests; P11/P12
retain wire shapes and document the stricter approval gate; P16 has changelog
entries; P19/P22 improve authentication and cancellation. P21 remains a concern
because the dependency audit is not clean and downloaded-tool pinning remains.
P6/P13 aggregate concurrency and P19 model-controlled consent are tracked above.
The project's recorded stack and v1 envelope decisions take precedence over
generic plugin preferences (ADR 046 monorepo, ADR 051 auth, ADR 069 tooling).
P18 is enforced by browser axe checks at the recorded viewports. P9 rollback is
a revert of the scoped commits; no schema migration or new feature flag is needed.
P20: no credentials were added to the diff. Existing auth telemetry is retained
(P5); there is no new service, alert, or deployment topology (P30/C1–C10 n/a).
ADR 071 accompanies the new CI standard; ADR 051
clarifies its existing atomic revocation intent. No new library was introduced.
