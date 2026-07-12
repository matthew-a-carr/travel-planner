# ADR 065: Mobile E2E Ephemeral HTTPS Tunnel

**Date:** 2026-07-11
**Status:** Accepted

## Context

ADR 060 placed the real Next.js/Postgres backend on the same GitHub macOS
runner as the iOS Simulator. The runner can reach that backend, but the Release
app sends no request to it. CI evidence ruled out numeric loopback, the runner
LAN address, the `localhost` hostname, IPv4 any-address binding, and IPv6
any-address binding. EPIC-006's pre-committed pivot criterion therefore fired:
authenticated mobile E2E needs a device-reachable HTTPS origin without
replacing the real backend or its database.

The existing test-only authentication endpoint is intentionally absent from
production, but making the CI backend internet-reachable changes its threat
boundary. Exact tool/version selection and fail-closed authentication must be
mechanically reviewable.

## Decision

The `mobile-e2e` job keeps the real backend and native PostgreSQL on the macOS
runner and publishes that backend through a Cloudflare Quick Tunnel for the
duration of the job.

- CI downloads the ARM macOS `cloudflared` 2026.7.1 release artifact and
  verifies its pinned SHA-256 digest before execution.
- The tunnel forwards its generated `https://*.trycloudflare.com` origin to
  runner-local port 3000. The Release bundle receives that origin through
  `EXPO_PUBLIC_API_BASE_URL`; CI waits for its authoritative DNS record through
  DNS-over-HTTPS before the first system-resolver lookup and pins that answer
  in the ephemeral runner's hosts file so CoreSimulator cannot retain the
  hostname's publication-time NXDOMAIN. A tunnel canary and bundle-string
  assertion then run before Maestro.
- CI generates a cryptographically random 256-bit secret for each run. The
  test-auth endpoint returns its existing neutral 404 unless the opt-in flag,
  no-Vercel gate, and constant-time comparison of `X-E2E-Test-Secret` all pass.
  The CI-only Release bundle receives the secret through
  `EXPO_PUBLIC_E2E_AUTH_SECRET`. CI verifies the exact masked value exists in
  the bundle without printing it; the temporary strings file is not uploaded,
  so no artifact records the credential.
- Tunnel and backend logs are uploaded only on failure. The public origin is
  ephemeral; the database contains deterministic synthetic fixtures and is
  destroyed with the runner.

The local backend remains the system under test. The tunnel is transport, not
a second deployment or API implementation.

### Alternatives considered

- **Continue trying host addresses or Simulator privacy grants.** Rejected
  because five address/binding combinations produced zero app requests; more
  guesses violate the epic's bounded pivot criterion.
- **Deploy the branch to a persistent preview environment.** Rejected because
  it adds lifecycle, migration, credentials, and cleanup coupling to an E2E job
  that already owns an isolated real database.
- **Replace the backend with a fixture server.** Rejected because it loses the
  migration, authorization, shared-contract, and persistence fidelity that ADR
  060 established.
- **Use an unpinned package-manager install.** Rejected because runner image
  drift could silently change executable code in the CI trust boundary.

## Consequences

The simulator gets a standard trusted HTTPS origin while E2E continues to
exercise the production Next.js routes and real PostgreSQL persistence. The
authentication seam is safer than its previous runner-local form because it
also requires an unguessable, per-run credential.

The job now depends on GitHub release downloads and Cloudflare Quick Tunnel
availability. Tunnel startup is a distinct fail-fast step, its executable is
checksum-pinned, and its log is retained on failure. The CI app artifact embeds
the per-run secret, so it must remain undistributed and ephemeral; it is never
uploaded by the workflow. ADR 060 remains authoritative for backend fidelity,
fixtures, and journey structure, while this ADR supersedes its assumption that
Simulator traffic can reach the runner directly.
