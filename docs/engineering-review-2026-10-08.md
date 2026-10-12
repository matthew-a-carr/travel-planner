# Repository engineering review — 2026-10-08

Base: `0c02d2c` on `main`. Work branch: `fix/engineering-standards-review`.

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
| High | Vulnerable web authentication/framework versions and compatible transitives were installed. Updated Next.js to 16.3.8, Auth.js to beta.32, its Drizzle adapter to 1.11.3, and affected compatible transitives. | Production audit fell from 122 reports to 16; details and remaining risk below. |
| Medium | Google network calls had no explicit deadline; mobile deadlines stopped at response headers. Google now has a 15-second deadline; mobile keeps its existing deadline through body consumption. | Aborted-header/body tests and successful-response timer cleanup. |
| Medium | Import guards missed relative/dynamic/re-export forms and allowed an AI SDK type to cross into application code. Parse imports with the existing TypeScript compiler and resolve layer paths; use the existing domain chat part type. | Negative guard fixtures, architecture tests, and full type check. The documented type-only shared-wire exception is retained. |
| Medium | Actions used movable tags and inherited token scopes; preview input could become shell syntax, and paginated inventory could emit multiple maps. Pin action SHAs, declare permissions, pass input through environment variables, aggregate pages, and validate/compact JSON. | Sixteen workflow security checks; shell smoke with quotes, command substitution, newlines, and invalid JSON values. ADR 071 records the standard. |
| Medium | CI used end-of-life Node.js 20. Move repository checks and documented development requirements to Node.js 24 LTS. | Local verification on Node.js 24; hosted/native CI remains a merge gate. [Node.js release schedule](https://nodejs.org/en/about/previous-releases). |

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

The audit still exits nonzero. Remaining high reports are two `image-size`
advisories through Expo/Metro (the fix crosses the installed major), `node-forge`
through Expo CLI, and `braces` through Metro's file matcher. The latter two have
no patched version reported by the registry. Moderate/low reports include
OpenTelemetry via Sentry, Expo's `uuid`/`decode-uri-component`, test-tooling
`sprintf-js`, and AI SDK provider utilities. Do not force incompatible overrides
to make the count zero. Track these in TD-011 and validate native changes through
the existing SDK upgrade and Maestro gates.

## Remaining findings and required follow-up

| Priority | Evidence / limitation | Recommended next work |
|---|---|---|
| High | `infrastructure/ai/chat-tools.ts` accepts model-supplied `confirmed: true`; `ToolCallCard.tsx` sends plain confirmation text. No server-owned approval record binds the actor, arguments, and pending operation. This is a design finding, not a demonstrated external exploit. | TD-012: design a server-validated approval transition and tests for model-forged/replayed consent before widening AI mutation access. |
| Medium | `create-trip-with-destinations.ts` compensates only a returned validation failure, not a thrown repository failure. `add-destination.ts` validates shared budget state before a separate save; distinct idempotency keys do not serialize the trip aggregate. Concurrency impact is inferred from source, not reproduced in this pass. | TD-013: transaction-scoped use cases and an aggregate lock/serializable policy across web, v1, and chat, with failure-injection and concurrent-budget tests. |
| Medium | AI/email adapters and the database client do not establish application-owned operation deadlines. Provider defaults are not a documented service budget. | TD-014: define deadlines/cancellation at each boundary and test stalled upstream calls, preserving safe retry semantics. |
| Medium | Installation reports Expo Router peers needing constants 18/linking 8 while 55-series packages are resolved; mobile React 19.1 also sees React DOM/type peers for 19.2. These warnings predate this change. | TD-015: reconcile the SDK 54 dependency graph under ADR 053/TD-003 and validate a clean native build; JavaScript tests cannot settle native compatibility. |
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
No production deploy, Terraform apply, push, or external message was performed.

## Verification

| Check | Result |
|---|---|
| `pnpm lint` | Passed; 425 files in the configured scope. |
| `pnpm type-check` | Passed for all three packages. |
| `pnpm -r --workspace-concurrency=1 test:unit` | Passed: shared 82, web 548, mobile 158, plus 14 mobile script checks. No skips. |
| `pnpm test:integration` | Passed: 392 tests across 74 files, real Testcontainers PostgreSQL. |
| `POSTGRES_URL=postgresql://build:build@localhost:5432/build pnpm build` | Passed with Next.js 16.3.8. |
| Migration policy, OpenAPI and visa-schema drift | Passed. |
| Mobile parity manifest | Passed incremental validation; 14 capabilities remain missing. |
| `terraform fmt -check -recursive infra` | Passed. No apply or remote-state changes. |
| Workflow input smoke | Passed: shell payload stays data, multiline JSON is compact, non-string map values fail. |
| Production dependency audit | **Not clean**: 16 reports remain; see TD-011. |
| Web Playwright suite | **Blocked by execution interruptions**: full runs reported 82/83/78 passed, 3/2/7 failed, and one existing skip each. Trace/sleep evidence below; an uninterrupted full run is still required. |
| Native Maestro / hosted CI / production smoke | Not run; required before claiming a release is verified. |

Two default concurrent unit runs timed out in different mobile tests. All 158
mobile tests passed in 4.1 seconds in isolation, and the entire unit suite passed
when workspaces ran sequentially. Later investigation established repeated host
sleep interruptions; contention may also have contributed to the parallel runs.
No timeouts were increased and no assertions were suppressed.

Web E2E run 1 timed out in organization switching and two accessibility journeys.
Run 2 passed those tests but timed out in timeline creation and desktop dashboard
accessibility. These were timing/navigation failures rather than axe violation
reports. Browser logs also included `The destination stream closed early` during
navigation. The suite's existing production-mode local-dev-auth test was skipped.
The three targeted timeline/dashboard diagnostic tests passed with tracing on.
A third full run retained failure traces and exposed the execution interruption:
macOS repeatedly entered maintenance sleep even with `caffeinate -i`. The login
accessibility trace stalled for 1,012.7 seconds around the 16:10–16:27 BST sleep
interval recorded by `pmset` (1,015 seconds); the members-page trace stalled for
266 seconds around a 269-second sleep. These timings explain the extreme stalls,
but are not proof that every failure has the same cause. Run the full suite on
an awake host or CI before merging. No tests were skipped or weakened to obtain
a pass.

Local diagnostic evidence (temporary, not committed):
`/tmp/travel-e2e-traced-full.log`, `/tmp/travel-browser-sleep.log`, and
`apps/web/test-results/*/trace.zip`. Traces contain test session data and should
stay within the normal private CI artifact boundary.

Three logical commits were created before 1Password signing failed. Remaining
changes are in the working tree/index; signing was not disabled or bypassed.

## Architecture review

Must-check dispositions from the `architecture-review` skill:

- **P15 — Conventional Commits: aligned** for the commits created so far.
- **P17 — Small commits: concern**: initial fixes are separate logical commits;
  further commit creation was blocked by the configured 1Password signer.
- **P3 — Small slice: concern**: this is an explicitly requested repository-wide
  review spanning several surfaces. Review the auth, dependency, and CI groups
  separately before merging; it is larger than an ordinary feature slice.
- **P4 — Root cause: aligned**: fixes address claim validation, stale approval,
  atomicity, timeout lifetime, and missing enforcement. No temporary mitigations
  or remove-by exceptions were introduced.
- **P7 — Tests: concern**: unit, real-Postgres integration, and contract drift
  pass, but the full browser gate needs an uninterrupted run after confirmed
  host-sleep interruptions. Regression tests were demonstrated failing before auth
  and workflow fixes. No skipped tests were added; verification limits are
  recorded explicitly above.
- **P31 — Trunk-based: aligned**: isolated review branch off `main`; nothing
  deployed or merged, and no unfinished product feature was introduced.
- **P33 — Review etiquette: aligned**: findings distinguish reproduced defects,
  source-based inferences, and optional follow-up, with concrete evidence.

Relevant checks: P2/P14 layering and CI rules are mechanically enforced; P11/P12
retain wire shapes and document the stricter approval gate; P16 has changelog
entries; P19/P22 improve authentication and cancellation. P21 remains a concern
because the dependency audit is not clean and downloaded-tool pinning remains.
P6/P13 aggregate concurrency and P19 model-controlled consent are tracked above.
The project's recorded stack and v1 envelope decisions take precedence over
generic plugin preferences. ADR 071 accompanies the new CI standard; ADR 051
clarifies its existing atomic revocation intent. No new library was introduced.
