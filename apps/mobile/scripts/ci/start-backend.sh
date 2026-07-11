#!/usr/bin/env bash
# Boot the real Next.js production server in the background for the
# mobile-e2e job (SPEC-013 / ADR 060). Assumes:
#   - POSTGRES_URL points at the migrated + seeded database
#     (start-postgres.sh, then pnpm db:migrate / db:seed / seed:e2e).
#   - `pnpm build` already ran (ADR 010 dummy-URL build).
#   - Auth env (AUTH_SECRET etc.) is set at the job level, mirroring the
#     web e2e job — next-auth needs it at boot.
#
# Binds `-H ::` so both IPv6 `::1` and IPv4-mapped loopback reach the process.
# SPEC-020's first authoritative run proved every runner-side gate but left the
# app waiting on its first request: the bundle used hostname `localhost` while
# the server listened only on IPv4 `0.0.0.0`. The existing runner canary still
# proves server boot; the authenticated Maestro journey proves app reachability.
#
# The server is intentionally NOT awaited here: the canary step curls it
# after xcodebuild, by which point the ~5s boot is long done — same
# overlap trick as the background simulator boot (ADR 055).
#
# Outputs:
#   $RUNNER_TEMP/backend.log — server stdout/stderr (uploaded on failure).
#   BACKEND_PID in $GITHUB_ENV — recorded for debuggability.
set -euo pipefail

: "${POSTGRES_URL:?POSTGRES_URL must be set (run start-postgres.sh first)}"

LOG_FILE="${RUNNER_TEMP:-/tmp}/backend.log"

# Call the web app's `next start` directly with -H :: — forwarding the
# flag cleanly through the nested root→web pnpm `start` scripts is fragile.
nohup pnpm --filter @travel-planner/web exec next start -H :: >"$LOG_FILE" 2>&1 &
BACKEND_PID=$!
echo "Backend starting (pid $BACKEND_PID) bound to :: (dual-stack), log: $LOG_FILE"

if [ -n "${GITHUB_ENV:-}" ]; then
  echo "BACKEND_PID=$BACKEND_PID" >>"$GITHUB_ENV"
fi
