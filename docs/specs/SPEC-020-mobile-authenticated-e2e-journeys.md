# SPEC-020: Mobile Authenticated E2E Journeys

**Date:** 2026-07-11
**Status:** In Progress
**Author:** Codex
**Approved by:** Matt Carr, 2026-07-11 (full mobile parity instruction)
**Parent epic:** [EPIC-006 — Mobile-Web Capability Parity](../epics/EPIC-006-mobile-web-capability-parity.md)

> First slice of EPIC-006 and the completion path for EPIC-004 slice 3.
> The slice fixes the blocking real-backend reachability seam before any new
> mobile product capability is added.

---

## 1. Summary

Mobile CI will sign in as the deterministic E2E user, load the real trips list
and trip detail from the real Next.js/Postgres backend, exercise the neutral
not-found state, and sign out. This replaces the current launch-only smoke with
proof that the shipped authenticated mobile journey works end to end.

## 2. Motivation

[TD-010](../tech-debt.md) blocks every authenticated mobile journey because
the Release app was pointed first at host loopback by numeric address and then
at the runner LAN address, while the runner-side canary alone remained green.
The final SPEC-014 PR removed its signed-in flow to restore CI. EPIC-006 makes
the gate a prerequisite for all parity work. This slice inherits the real
backend, gated auth seam, fixture, test-pyramid, and native-UI decisions from
[EPIC-006 §10](../epics/EPIC-006-mobile-web-capability-parity.md#10-cross-cutting-decisions)
and [ADR 060](../decisions/060-mobile-e2e-real-backend-authenticated-journeys.md).

Apple documents that local-network privacy is not implemented in Simulator,
and Expo's Release-Simulator guidance uses `localhost` for a server on the Mac.
The first tracer bullet therefore uses the hostname `localhost`, not the
numeric loopback or LAN address tried by SPEC-014.

## 3. Acceptance criteria

1. Given the `mobile-e2e` job, when the Release bundle is built, then
   `EXPO_PUBLIC_API_BASE_URL` is `http://localhost:3000`, the backend answers
   there, and the bundle contains that origin.
2. Given a fresh installed E2E app, when Maestro taps Sign in, then the existing
   double-gated test browser leg completes real `/start` → `/test-token` →
   `/exchange` → Keychain → `/me` and the trips screen renders.
3. Given the deterministic fixtures, when the authenticated journey opens
   `Kyoto Adventure`, then the detail screen renders both destination legs,
   the fixed cost, and the spend summary from the real endpoint.
4. Given a non-existent trip deep link while signed in, when it opens, then the
   neutral `trip-detail-not-found` state renders and the user can return to the
   trips list.
5. Given the profile screen, when the user signs out, then Keychain/auth state
   clears, revoke is attempted, and the sign-in screen renders again.
6. The existing signed-out smoke and all mobile component/unit tests remain
   green; no production auth or API behavior changes.
7. If the localhost tracer bullet fails on the GitHub arm64 runner, the failure
   must distinguish app transport/network failure from auth/backend failure.
   The documented epic pivot is then applied rather than adding more address
   guesses.

## 4. Demo script

1. Run the `mobile-e2e` job and observe backend canary, bundle-origin assertion,
   and test-auth server seam smoke pass.
2. Maestro launches the app, taps Sign in, and sees `Kyoto Adventure`.
3. Open the trip and see Kyoto, Tokyo, Flights to Japan, and the spend card.
4. Return to the list, open a missing-trip deep link, and see Trip not found.
5. Return, open Profile, sign out, and see Sign in with Google.

## 5. Out of scope

- The parity manifest, recording artifacts, local one-command orchestration,
  and budget analysis — EPIC-006 slice 2 / EPIC-004 slice 4.
- New mobile product features or new v1 endpoints.
- Real Google consent automation, Android, physical-device automation, and
  visual regression — inherited EPIC non-goals.
- Changing the double-gated test-auth endpoint or exposing it in OpenAPI.

## 6. Prerequisites

- SPEC-013 and SPEC-014 are complete: real backend/fixtures and both halves of
  the test-auth seam are already merged.
- `E2E_TEST_AUTH=1` and `EXPO_PUBLIC_E2E_AUTH=1` remain CI-only; Vercel never
  defines either.
- The GitHub job has a bootable iOS Simulator and can build the existing Expo
  SDK 54 Release app.

## 7. Design

### Data & domain

No domain or storage change. The flow consumes `E2E_FIXTURES` exactly as
seeded by SPEC-013. Stable fixture IDs are copied into Maestro selectors only
where a runtime import is impossible; the flow comment links back to the
fixture source.

### Behaviour

The server and auth seam are unchanged. The CI bundle origin changes from the
runner's LAN IP to `http://localhost:3000`. The Next server may continue
binding `0.0.0.0`; it therefore answers both the host canary and Simulator
loopback without another server mode.

One `authenticated-read-journey.yaml` flow owns the stateful journey so flow
ordering and Keychain persistence cannot leak between independent flows:

1. launch and wait for sign-in;
2. sign in via the substitute browser leg;
3. assert seeded list/detail evidence;
4. return and open the missing-trip deep link;
5. return to list, open Profile, sign out.

The existing `sign-in.yaml` stays as the cheap cold-launch smoke. The new flow
uses stable `testID` selectors only. Small additional testIDs may be added to
already-rendered detail values; they do not alter product behavior.

### Storage & migrations

N/A — the existing throwaway Postgres, migrations, and idempotent E2E seed are
reused unchanged.

### External integrations

No new integration. Apple Simulator and Expo/React Native behavior are the
existing platform boundary. The test-auth seam continues to replace Google
only inside the E2E bundle.

### UI / UX

No visible production UI change. Test IDs remain accessibility-neutral and
all existing controls retain their labels, roles, and 44-point targets.

## 8. Security & data considerations

- Threats considered: accidentally enabling the auth seam in production,
  exposing the local HTTP exception beyond local resources, fixture data
  escaping CI, and unauthorised trip enumeration through the not-found flow.
- Mitigations: SPEC-014's exact-value env flag plus no-Vercel gate remain
  integration-tested; `NSAllowsLocalNetworking` is already scoped to local
  resources; fixtures are synthetic and runner-local; missing and forbidden
  trips retain the same neutral 404 state.
- Secrets needed: none. CI auth/JWT values remain explicit non-secret
  throwaway strings.

## 9. Test plan

Tests are written before implementation per CONSTITUTION §3.

### E2E (Maestro)

| Test file | Scenario |
|---|---|
| `apps/mobile/.maestro/flows/sign-in.yaml` | Existing signed-out Release launch remains green |
| `apps/mobile/.maestro/flows/authenticated-read-journey.yaml` | Real sign-in, seeded list/detail, missing-trip state, and sign-out against real backend |

### Integration (Vitest + Testcontainers)

| Test file | What it covers |
|---|---|
| Existing mobile auth route/use-case integration suites | Double gate, start/mint/exchange chain, token/revoke behavior remain green |
| Existing trip list/detail route integration suites | Bearer auth, organization visibility, deterministic detail response remain green |

### Unit (Jest)

| Test file | What it covers |
|---|---|
| Existing mobile auth, list, detail, and screen suites | State/error/accessibility behavior touched by the journey remains green |
| Detail component test (only if testIDs are added) | Stable evidence selectors render on fixture-shaped data |

### Manual checks

- The GitHub `mobile-e2e` run is the authoritative environment check because
  this workstation has no installed iOS Simulator runtime.
- Physical iPhone validation is not required for a CI-only behavior change;
  the production bundle path is unchanged.

## 10. Observability

- The runner-side backend canary and `/start` → `/test-token` seam smoke remain
  separate fail-fast stages.
- On a red Maestro flow, the backend log shows whether any app request arrived;
  an auth/UI failure therefore differs from a transport failure.
- Full screen recording and structured app-side network diagnostics remain
  EPIC-006 slice 2; this slice does not add production telemetry.

## 11. Rollback / safety

Revert the slice commit. CI returns to the signed-out smoke and the LAN-IP
bundle target; production, database schema, and deployed API remain unchanged.
If localhost cannot work on the runner, revert the tracer bullet before
implementing ADR 060's reviewed HTTPS/remote-backend pivot.

## 12. Implementation order

1. [ ] **Intent:** Add the authenticated Maestro journey first; SPEC-014's
   recorded runner failures are the existing red evidence for this exact
   behavior. **Verification:** YAML parses and every selector resolves to a
   committed screen `testID`; do not push an intentionally failing commit.
2. [ ] **Intent:** Point build, canary, seam smoke, and bundle assertion at
   `http://localhost:3000`; remove obsolete LAN-IP detection. **Verification:**
   workflow diff contains one canonical origin and `git diff --check` passes.
3. [ ] **Intent:** Add only the stable detail evidence selectors the journey
   needs. **Verification:** focused RNTL detail test is red then green.
4. [ ] **Intent:** Run local non-Simulator gates. **Verification:** `pnpm lint`,
   `pnpm type-check:mobile`, `pnpm test:mobile`, relevant web unit/integration
   tests, `pnpm openapi:check`, and production build all exit 0.
5. [ ] **Intent:** Push and force the path-filtered mobile jobs. **Verification:**
   `mobile-e2e` passes the existing smoke plus authenticated read journey; all
   other required CI checks are green.
6. [ ] **Intent:** Close documentation truth. **Verification:** SPEC status,
   EPIC-004/006 ledgers, TD-010, CHANGELOG (not required: CI-only behavior),
   and implementation notes agree with the observed runner result.

## 13. ADR triggers and tech-debt review

### ADR?

- [ ] New library, external tool, or vendor
- [x] CI pipeline or workflow structural change
- [ ] New project-wide standard
- [ ] Non-obvious architectural trade-off
- [ ] Cross-cutting decision not already settled by the parent epic

**ADRs to write:** none for the localhost correction; ADR 055/060 already own
the CI architecture. Amend ADR 060 only if the epic's remote-HTTPS pivot fires.

### Tech debt

- [x] I reviewed `docs/tech-debt.md` and noted any items this spec touches or
  could resolve.

**Tech debt items addressed by this spec:** TD-010. TD-009's cache discipline
and retry insurance remain unchanged.

## 14. Risks & open questions

- **Choice made:** try hostname loopback (`localhost`) once, based on Apple and
  Expo Simulator guidance. **Rejected:** another numeric/LAN address guess.
  **Cost if wrong:** one macOS CI iteration, after which the pre-committed HTTPS
  pivot is used.
- Maestro deep-link syntax may vary with the generated Expo Router scheme.
  The chosen URL is `travelplanner:///trips/<id>`; if the route does not open,
  use the Router-generated equivalent without changing product code.
- The new flow is intentionally stateful and singular. Splitting it would need
  an explicit Keychain reset strategy and belongs in the operations slice.

---

## Implementation Deviations

| # | Deviation | Reason | Impact | Resolved? |
|---|-----------|--------|--------|-----------|

### Post-Implementation Notes

_Filled at close-out._
